import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "react-router-dom";
import type { ViewerSummary } from "../../../../packages/shared/src";
import { EventTimeline } from "../components/EventTimeline";
import { GroupForm } from "../components/GroupForm";
import { MeetingForm } from "../components/MeetingForm";
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
import { createNavigationState, resolveNavigationState } from "../lib/navigation";
import { queryClient } from "../lib/query-client";

export function GroupPage({ viewer }: { viewer: ViewerSummary | null }) {
  const { groupId = "" } = useParams();
  const location = useLocation();
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
    return <div className="loading-shell">Loading group...</div>;
  }

  if (groupQuery.isError || !groupQuery.data) {
    return <div className="error-shell">{groupQuery.error?.message ?? "Group not found."}</div>;
  }

  const { group, inviteLinks, members, meetings, posts } = groupQuery.data;
  const backTarget = resolveNavigationState(location.state, "/groups", "Groups");
  const groupNavigationState = createNavigationState(location, group.name);

  return (
    <div className="page-wrap page-wrap--workspace">
      <section className="workspace-board">
        <aside className="board-column">
          <div className="board-column__header">
            <div>
              <p className="eyebrow">{group.visibility} group</p>
              <h2 className="section-title typewriter-title">Group: {group.name}</h2>
            </div>
            <Link className="button-secondary button-inline" to={backTarget.fromPath}>
              Back
            </Link>
          </div>

          <div className="board-column__body">
            <div className="board-column__section">
              <p className="muted-copy">{group.description}</p>
              <div className="compact-badges">
                {group.activityLabel ? <span className="badge-invert">{group.activityLabel}</span> : null}
                <span className="badge">{members.length} members</span>
                <span className="badge-outline">Role: {group.viewerRole ?? "guest"}</span>
              </div>
            </div>

            <div className="board-column__section">
              <div className="metrics-grid metrics-grid--compact">
                <div className="metric-box">
                  <p className="metric-box__value">{meetings.length}</p>
                  <p className="metric-box__label">Meetings</p>
                </div>
                <div className="metric-box">
                  <p className="metric-box__value">{members.length}</p>
                  <p className="metric-box__label">Members</p>
                </div>
              </div>
            </div>

            <div className="board-column__section">
              <div className="board-column__actions">
                {!group.viewerRole && group.visibility === "public" && viewer ? (
                  <button className="button-primary" onClick={() => joinMutation.mutate()} type="button">
                    Join group
                  </button>
                ) : null}
                {meetings.length > 0 ? (
                  <Link className="button-secondary" state={groupNavigationState} to={`/meetings/${meetings[0].id}`}>
                    Open next session
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </aside>

        <div className="board-column">
          <div className="board-column__header">
            <div>
              <p className="eyebrow">Group</p>
              <h2 className="section-title typewriter-title">Board and management</h2>
            </div>
            {group.viewerCanCreateMeeting ? (
              <a className="button-secondary button-inline" href="#create-meeting">
                Create meeting
              </a>
            ) : null}
          </div>

          <div className="board-column__body">
            <section className="workspace-section stack-md">
              <div className="workspace-section__header">
                <div className="stack-sm">
                  <p className="muted-copy">Manage group settings, members, posts, and new sessions from one place.</p>
                </div>
              </div>

              <div className="metrics-grid metrics-grid--compact">
                <div className="metric-box">
                  <p className="metric-box__value">{meetings.length}</p>
                  <p className="metric-box__label">Meetings</p>
                </div>
                <div className="metric-box">
                  <p className="metric-box__value">{members.length}</p>
                  <p className="metric-box__label">Members</p>
                </div>
              </div>
            </section>

            {group.viewerCanEditGroup ? (
              <section className="workspace-section stack-md">
                <div>
                  <p className="eyebrow">Edit group</p>
                  <h2 className="section-title">Adjust labels and visibility</h2>
                </div>
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
              </section>
            ) : null}

            {group.viewerCanCreateMeeting ? (
              <section className="workspace-section stack-md" id="create-meeting">
                <div>
                  <p className="eyebrow">Create meeting</p>
                  <h2 className="section-title">Launch a one-time or weekly session</h2>
                </div>
                <MeetingForm
                  groups={groupsQuery.data?.groups ?? []}
                  onSubmit={async (payload) => createMeetingMutation.mutateAsync(payload)}
                />
              </section>
            ) : null}

            <section className="workspace-section stack-md">
              <div>
                <p className="eyebrow">Members</p>
                <h2 className="section-title">Roster</h2>
              </div>

              <div className="stack-sm">
                {members.map((member) => (
                  <div className="terminal-item" key={member.user.id}>
                    <div className="terminal-item__row">
                      <div>
                        <p className="terminal-item__title">{member.user.displayName}</p>
                        <p className="terminal-item__meta">{member.role}</p>
                      </div>
                      {group.viewerCanManageMembers && member.role !== "owner" ? (
                        <select
                          className="field-select"
                          defaultValue={member.role}
                          onChange={(event) =>
                            roleMutation.mutate({
                              role: event.target.value as "admin" | "member",
                              userId: member.user.id,
                            })
                          }
                          style={{ maxWidth: "9rem" }}
                        >
                          <option value="member">member</option>
                          <option value="admin">admin</option>
                        </select>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {group.viewerCanManageMembers ? (
              <section className="workspace-section stack-md">
                <div className="workspace-section__header">
                  <div>
                    <p className="eyebrow">Invite codes</p>
                    <h2 className="section-title">Private-group access</h2>
                  </div>
                  <button className="button-primary" onClick={() => inviteMutation.mutate()} type="button">
                    Generate code
                  </button>
                </div>

                <div className="stack-sm">
                  {inviteLinks.length === 0 ? (
                    <p className="empty-state">No invite codes created yet.</p>
                  ) : (
                    inviteLinks.map((link) => (
                      <div className="terminal-item" key={link.id}>
                        <p className="terminal-item__title">{link.code}</p>
                        <p className="terminal-item__meta">Created {formatDateTime(link.created_at)}</p>
                      </div>
                    ))
                  )}
                </div>
              </section>
            ) : null}

            <PostBoard
              buttonLabel="Post to group"
              canPost={Boolean(group.viewerRole)}
              emptyLabel="No group posts yet."
              onSubmit={async (content) => postMutation.mutateAsync(content)}
              posts={posts}
              title={`${group.name} internal board`}
            />
          </div>
        </div>

        <aside className="board-column">
          <div className="board-column__header">
            <div>
              <p className="eyebrow">Upcoming sessions</p>
              <h2 className="section-title typewriter-title">Group events</h2>
            </div>
            <span className="badge">{meetings.length}</span>
          </div>

          <div className="board-column__body">
            <EventTimeline
              contextLabel={group.name}
              emptyLabel="No meetings yet for this group."
              heading="Group events"
              meetings={meetings}
              secondaryMeta="location"
              showHeader={false}
              showGroupLabel={false}
              variant="embedded"
            />
          </div>
        </aside>
      </section>
    </div>
  );
}
