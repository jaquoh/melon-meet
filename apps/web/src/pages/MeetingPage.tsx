import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import type { ViewerSummary } from "../../../../packages/shared/src";
import { MeetingForm } from "../components/MeetingForm";
import { PanelCard } from "../components/PanelCard";
import { PostBoard } from "../components/PostBoard";
import {
  cancelMeeting,
  claimMeeting,
  createMeetingPost,
  getGroups,
  getMeeting,
  unclaimMeeting,
  updateMeeting,
} from "../lib/api";
import { formatDateTime } from "../lib/format";
import { queryClient } from "../lib/query-client";

export function MeetingPage({ viewer }: { viewer: ViewerSummary | null }) {
  const { meetingId = "" } = useParams();
  const meetingQuery = useQuery({
    queryFn: () => getMeeting(meetingId),
    queryKey: ["meeting", meetingId],
  });
  const groupsQuery = useQuery({
    queryFn: getGroups,
    queryKey: ["groups"],
  });

  const claimMutation = useMutation({
    mutationFn: (claimed: boolean) => (claimed ? unclaimMeeting(meetingId) : claimMeeting(meetingId)),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["meeting", meetingId] }),
        queryClient.invalidateQueries({ queryKey: ["map"] }),
      ]);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelMeeting(meetingId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["meeting", meetingId] }),
        queryClient.invalidateQueries({ queryKey: ["map"] }),
      ]);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => updateMeeting(meetingId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["meeting", meetingId] }),
        queryClient.invalidateQueries({ queryKey: ["map"] }),
      ]);
    },
  });

  const postMutation = useMutation({
    mutationFn: (content: string) => createMeetingPost(meetingId, content),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["meeting", meetingId] });
    },
  });

  if (meetingQuery.isLoading) {
    return <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">Loading meeting...</div>;
  }

  if (meetingQuery.isError || !meetingQuery.data) {
    return <div className="mx-auto max-w-7xl px-4 py-10 text-red-600 sm:px-6 lg:px-8">{meetingQuery.error?.message ?? "Meeting not found."}</div>;
  }

  const { claims, meeting, posts } = meetingQuery.data;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid gap-5 xl:grid-cols-[1.05fr,0.95fr]">
        <section className="space-y-5">
          <PanelCard className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-500">
                  {meeting.groupName}
                </p>
                <h1 className="mt-1 text-4xl font-semibold text-stone-900">{meeting.title}</h1>
              </div>
              <span className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white">
                {meeting.claimedSpots}/{meeting.capacity} occupied
              </span>
            </div>
            <p className="text-sm leading-7 text-stone-600">
              {meeting.description || "No description yet."}
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-3xl bg-stone-50 px-4 py-4">
                <p className="text-sm font-medium text-stone-900">When</p>
                <p className="mt-1 text-sm text-stone-500">{formatDateTime(meeting.startsAt)}</p>
              </div>
              <div className="rounded-3xl bg-stone-50 px-4 py-4">
                <p className="text-sm font-medium text-stone-900">Where</p>
                <p className="mt-1 text-sm text-stone-500">{meeting.locationName}</p>
              </div>
              <div className="rounded-3xl bg-stone-50 px-4 py-4">
                <p className="text-sm font-medium text-stone-900">Pricing</p>
                <p className="mt-1 text-sm text-stone-500">{meeting.pricing}</p>
              </div>
              <div className="rounded-3xl bg-stone-50 px-4 py-4">
                <p className="text-sm font-medium text-stone-900">Open spots</p>
                <p className="mt-1 text-sm text-stone-500">{meeting.openSpots}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {viewer ? (
                <button
                  className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700"
                  onClick={() => claimMutation.mutate(meeting.viewerHasClaimed)}
                  type="button"
                >
                  {meeting.viewerHasClaimed ? "Release my spot" : "Claim a spot"}
                </button>
              ) : null}
              {meeting.viewerCanEdit ? (
                <button
                  className="rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:border-red-500"
                  onClick={() => cancelMutation.mutate()}
                  type="button"
                >
                  Cancel meeting
                </button>
              ) : null}
            </div>
          </PanelCard>

          {meeting.viewerCanEdit ? (
            <PanelCard>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-500">
                Edit meeting
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-stone-900">Adjust details and capacity</h2>
              <div className="mt-4">
                <MeetingForm
                  groups={groupsQuery.data?.groups ?? []}
                  initialMeeting={meeting}
                  onSubmit={async (payload) => updateMutation.mutateAsync(payload)}
                />
              </div>
            </PanelCard>
          ) : null}

          <PostBoard
            buttonLabel="Post to meeting"
            canPost={Boolean(viewer)}
            emptyLabel="No meeting updates yet."
            onSubmit={async (content) => postMutation.mutateAsync(content)}
            posts={posts}
            title="Meeting board"
          />
        </section>

        <aside className="space-y-5">
          <PanelCard>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-500">
              Claimed players
            </p>
            <div className="mt-4 space-y-3">
              {claims.length === 0 ? (
                <p className="rounded-3xl border border-dashed border-stone-200 bg-stone-50 px-4 py-5 text-sm text-stone-500">
                  Nobody has claimed a spot yet.
                </p>
              ) : (
                claims.map((claim) => (
                  <div className="rounded-3xl border border-stone-200/80 bg-stone-50/80 px-4 py-4" key={claim.id}>
                    <p className="font-medium text-stone-900">{claim.displayName}</p>
                    <p className="mt-1 text-sm text-stone-500">{claim.homeArea || claim.bio || "Ready to play"}</p>
                  </div>
                ))
              )}
            </div>
          </PanelCard>
        </aside>
      </div>
    </div>
  );
}
