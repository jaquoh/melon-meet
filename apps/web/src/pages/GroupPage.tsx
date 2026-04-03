import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import type { ViewerSummary } from "../../../../packages/shared/src";
import { GroupForm } from "../components/GroupForm";
import { MeetingForm } from "../components/MeetingForm";
import { PanelCard } from "../components/PanelCard";
import { PostBoard } from "../components/PostBoard";
import {
  createGroupPost,
  createInviteLink,
  createMeeting,
  getGroup,
  getGroups,
  joinGroup,
  updateGroup,
  updateMemberRole,
} from "../lib/api";
import { formatDateTime } from "../lib/format";
import { queryClient } from "../lib/query-client";

export function GroupPage({ viewer }: { viewer: ViewerSummary | null }) {
  const { groupId = "" } = useParams();
  const groupQuery = useQuery({
    queryFn: () => getGroup(groupId),
    queryKey: ["group", groupId],
  });
  const groupsQuery = useQuery({
    queryFn: getGroups,
    queryKey: ["groups"],
  });

  const joinMutation = useMutation({
    mutationFn: () => joinGroup(groupId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["group", groupId] }),
        queryClient.invalidateQueries({ queryKey: ["groups"] }),
      ]);
    },
  });

  const inviteMutation = useMutation({
    mutationFn: () => createInviteLink(groupId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["group", groupId] });
    },
  });

  const postMutation = useMutation({
    mutationFn: (content: string) => createGroupPost(groupId, content),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["group", groupId] });
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => updateGroup(groupId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["group", groupId] });
    },
  });

  const createMeetingMutation = useMutation({
    mutationFn: createMeeting,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["group", groupId] });
      await queryClient.invalidateQueries({ queryKey: ["map"] });
    },
  });

  const roleMutation = useMutation({
    mutationFn: ({ role, userId }: { role: "admin" | "member"; userId: string }) =>
      updateMemberRole(groupId, userId, role),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["group", groupId] });
    },
  });

  if (groupQuery.isLoading) {
    return <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">Loading group...</div>;
  }

  if (groupQuery.isError || !groupQuery.data) {
    return <div className="mx-auto max-w-7xl px-4 py-10 text-red-600 sm:px-6 lg:px-8">{groupQuery.error?.message ?? "Group not found."}</div>;
  }

  const { group, inviteLinks, members, meetings, posts } = groupQuery.data;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid gap-5 xl:grid-cols-[1.15fr,0.85fr]">
        <section className="space-y-5">
          <PanelCard className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-500">
                  {group.visibility} group
                </p>
                <h1 className="mt-1 text-4xl font-semibold text-stone-900">{group.name}</h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-600">{group.description}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                {!group.viewerRole && group.visibility === "public" && viewer ? (
                  <button className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700" onClick={() => joinMutation.mutate()} type="button">
                    Join group
                  </button>
                ) : null}
                {group.viewerCanCreateMeeting ? (
                  <a className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-900 hover:text-stone-900" href="#create-meeting">
                    Create meeting
                  </a>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              {group.activityLabel ? (
                <span className="rounded-full bg-orange-100 px-3 py-1 font-medium text-orange-700">
                  {group.activityLabel}
                </span>
              ) : null}
              <span className="rounded-full bg-stone-100 px-3 py-1 font-medium text-stone-600">
                {members.length} members
              </span>
              <span className="rounded-full bg-stone-100 px-3 py-1 font-medium text-stone-600">
                Role: {group.viewerRole ?? "guest"}
              </span>
            </div>
          </PanelCard>

          {group.viewerCanEditGroup ? (
            <PanelCard>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-500">
                Edit group
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-stone-900">Update group details</h2>
              <div className="mt-4">
                <GroupForm
                  initialValues={{
                    activityLabel: group.activityLabel,
                    description: group.description,
                    name: group.name,
                    slug: group.slug,
                    visibility: group.visibility,
                  }}
                  onSubmit={async (payload) => updateGroupMutation.mutateAsync(payload)}
                />
              </div>
            </PanelCard>
          ) : null}

          {group.viewerCanCreateMeeting ? (
            <PanelCard id="create-meeting">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-500">
                Create meeting
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-stone-900">Launch a one-time or weekly game</h2>
              <div className="mt-4">
                <MeetingForm
                  groups={groupsQuery.data?.groups ?? []}
                  onSubmit={async (payload) => createMeetingMutation.mutateAsync(payload)}
                />
              </div>
            </PanelCard>
          ) : null}

          <PanelCard>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-500">
              Upcoming meetings
            </p>
            <div className="mt-4 space-y-3">
              {meetings.length === 0 ? (
                <p className="rounded-3xl border border-dashed border-stone-200 bg-stone-50 px-4 py-5 text-sm text-stone-500">
                  No meetings yet for this group.
                </p>
              ) : (
                meetings.map((meeting) => (
                  <Link className="block rounded-3xl border border-stone-200/80 bg-stone-50/80 px-4 py-4 transition hover:border-stone-900" key={meeting.id} to={`/meetings/${meeting.id}`}>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-stone-900">{meeting.title}</p>
                        <p className="mt-1 text-sm text-stone-500">{formatDateTime(meeting.startsAt)}</p>
                      </div>
                      <span className="rounded-full bg-stone-900 px-3 py-1 text-xs font-medium text-white">
                        {meeting.claimedSpots}/{meeting.capacity}
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </PanelCard>

          <PostBoard
            buttonLabel="Post to group"
            canPost={Boolean(group.viewerRole)}
            emptyLabel="No group posts yet."
            onSubmit={async (content) => postMutation.mutateAsync(content)}
            posts={posts}
            title={`${group.name} internal board`}
          />
        </section>

        <aside className="space-y-5">
          <PanelCard>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-500">
              Members
            </p>
            <div className="mt-4 space-y-3">
              {members.map((member) => (
                <div className="rounded-3xl border border-stone-200/80 bg-stone-50/80 px-4 py-4" key={member.user.id}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-stone-900">{member.user.displayName}</p>
                      <p className="text-sm text-stone-500">{member.role}</p>
                    </div>
                    {group.viewerCanManageMembers && member.role !== "owner" ? (
                      <select
                        className="rounded-full border-stone-200 bg-white px-3 py-2 text-xs"
                        defaultValue={member.role}
                        onChange={(event) =>
                          roleMutation.mutate({
                            role: event.target.value as "admin" | "member",
                            userId: member.user.id,
                          })
                        }
                      >
                        <option value="member">member</option>
                        <option value="admin">admin</option>
                      </select>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </PanelCard>

          {group.viewerCanManageMembers ? (
            <PanelCard>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-500">
                    Invite codes
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-stone-900">Private-group invites</h2>
                </div>
                <button className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700" onClick={() => inviteMutation.mutate()} type="button">
                  Generate code
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {inviteLinks.length === 0 ? (
                  <p className="rounded-3xl border border-dashed border-stone-200 bg-stone-50 px-4 py-5 text-sm text-stone-500">
                    No invite codes created yet.
                  </p>
                ) : (
                  inviteLinks.map((link) => (
                    <div className="rounded-3xl border border-stone-200/80 bg-stone-50/80 px-4 py-4" key={link.id}>
                      <p className="font-mono text-sm text-stone-900">{link.code}</p>
                      <p className="mt-1 text-xs text-stone-500">Created {formatDateTime(link.created_at)}</p>
                    </div>
                  ))
                )}
              </div>
            </PanelCard>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
