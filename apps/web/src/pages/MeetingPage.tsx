import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "react-router-dom";
import type { ViewerSummary } from "../../../../packages/shared/src";
import { EventTimeline } from "../components/EventTimeline";
import { MeetingForm } from "../components/MeetingForm";
import { PanelCard } from "../components/PanelCard";
import { PostBoard } from "../components/PostBoard";
import {
  cancelMeeting,
  claimMeeting,
  createMeetingPost,
  getGroup,
  getGroups,
  getMeeting,
  getVenue,
  unclaimMeeting,
  updateMeeting,
} from "../lib/api";
import { formatDateTime } from "../lib/format";
import { resolveNavigationState } from "../lib/navigation";
import { queryClient } from "../lib/query-client";

export function MeetingPage({ viewer }: { viewer: ViewerSummary | null }) {
  const { meetingId = "" } = useParams();
  const location = useLocation();
  const meetingQuery = useQuery({
    queryFn: () => getMeeting(meetingId),
    queryKey: ["meeting", meetingId],
  });
  const groupsQuery = useQuery({
    queryFn: getGroups,
    queryKey: ["groups"],
  });

  const groupTimelineQuery = useQuery({
    enabled: Boolean(meetingQuery.data?.meeting.groupId),
    queryFn: () => getGroup(meetingQuery.data!.meeting.groupId),
    queryKey: ["group", meetingQuery.data?.meeting.groupId, "timeline"],
  });
  const venueQuery = useQuery({
    enabled: Boolean(meetingQuery.data?.meeting.venueId),
    queryFn: () => getVenue(meetingQuery.data!.meeting.venueId!),
    queryKey: ["venue", meetingQuery.data?.meeting.venueId, "related"],
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
    return <div className="loading-shell">Loading meeting...</div>;
  }

  if (meetingQuery.isError || !meetingQuery.data) {
    return <div className="error-shell">{meetingQuery.error?.message ?? "Meeting not found."}</div>;
  }

  const { claims, meeting, posts } = meetingQuery.data;
  const relatedMeetings =
    venueQuery.data?.meetings.length && meeting.venueId
      ? venueQuery.data.meetings
      : groupTimelineQuery.data?.meetings ?? [];
  const timelineHeading = venueQuery.data?.meetings.length && meeting.venueId ? "Venue events" : "Group events";
  const timelineMeta = venueQuery.data?.meetings.length && meeting.venueId ? "group" : "location";
  const backTarget = resolveNavigationState(location.state, "/", "Map board");

  return (
    <div className="page-wrap page-wrap--workspace">
      <section className="home-main-shell">
        <aside className="timeline-rail">
          <EventTimeline
            contextLabel={meeting.title}
            emptyLabel="No related meetings found."
            heading={timelineHeading}
            meetings={relatedMeetings}
            secondaryMeta={timelineMeta}
            showGroupLabel={timelineMeta !== "location"}
          />
        </aside>

        <div className="workspace-main workspace-main--detail">
          <PanelCard className="detail-header">
            <div className="detail-header__nav">
              <Link className="button-secondary button-inline" to={backTarget.fromPath}>
                Back to {backTarget.fromLabel}
              </Link>
            </div>

            <div className="terminal-item__row">
              <div className="stack-sm">
                <p className="eyebrow">{meeting.groupName}</p>
                <h1 className="display-title">Session: {meeting.title}</h1>
                <p className="muted-copy">{meeting.description || "No description yet."}</p>
              </div>
              <div className="compact-badges">
                <span className="badge-invert">
                  {meeting.claimedSpots}/{meeting.capacity} occupied
                </span>
                {meeting.viewerHasClaimed ? <span className="badge-accent">Attending</span> : null}
              </div>
            </div>
          </PanelCard>

          <div className="detail-shell">
            <section className="stack-md">
              <PanelCard className="panel-card--highlight stack-md">
                <div className="info-grid">
                  <div className="terminal-item">
                    <p className="terminal-item__meta">When</p>
                    <p className="terminal-item__title">{formatDateTime(meeting.startsAt)}</p>
                  </div>
                  <div className="terminal-item">
                    <p className="terminal-item__meta">Where</p>
                    <p className="terminal-item__title">{meeting.locationName}</p>
                  </div>
                  <div className="terminal-item">
                    <p className="terminal-item__meta">Pricing</p>
                    <p className="terminal-item__title">{meeting.pricing}</p>
                  </div>
                  <div className="terminal-item">
                    <p className="terminal-item__meta">Open spots</p>
                    <p className="terminal-item__title">{meeting.openSpots}</p>
                  </div>
                </div>

                <div className="form-actions form-actions--start">
                  {viewer ? (
                    <button
                      className={meeting.viewerHasClaimed ? "button-accent" : "button-primary"}
                      onClick={() => claimMutation.mutate(meeting.viewerHasClaimed)}
                      type="button"
                    >
                      {meeting.viewerHasClaimed ? "Release my spot" : "Claim a spot"}
                    </button>
                  ) : null}
                  {meeting.viewerCanEdit ? (
                    <button className="button-danger" onClick={() => cancelMutation.mutate()} type="button">
                      Cancel meeting
                    </button>
                  ) : null}
                </div>
              </PanelCard>

              {meeting.viewerCanEdit ? (
                <PanelCard className="stack-md">
                  <div>
                    <p className="eyebrow">Edit meeting</p>
                    <h2 className="section-title">Adjust details and capacity</h2>
                  </div>
                  <MeetingForm
                    groups={groupsQuery.data?.groups ?? []}
                    initialMeeting={meeting}
                    onSubmit={async (payload) => updateMutation.mutateAsync(payload)}
                  />
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

            <aside className="stack-md">
              <PanelCard className="stack-md">
                <div>
                  <p className="eyebrow">Claimed players</p>
                  <h2 className="detail-title">Session roster</h2>
                </div>
                <div className="stack-sm">
                  {claims.length === 0 ? (
                    <p className="empty-state">Nobody has claimed a spot yet.</p>
                  ) : (
                    claims.map((claim) => (
                      <div className="terminal-item" key={claim.id}>
                        <p className="terminal-item__title">{claim.displayName}</p>
                        <p className="terminal-item__meta">{claim.homeArea || claim.bio || "Ready to play"}</p>
                      </div>
                    ))
                  )}
                </div>
              </PanelCard>

            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}
