import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "react-router-dom";
import type { ViewerSummary } from "../../../../packages/shared/src";
import { EventTimeline } from "../components/EventTimeline";
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
      <section className="home-main-shell">
        <aside className="timeline-rail">
          <EventTimeline
            contextLabel={group.name}
            emptyLabel="No meetings yet for this group."
            heading="Group events"
            meetings={meetings}
            secondaryMeta="location"
            showGroupLabel={false}
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
                <p className="eyebrow">{group.visibility} group</p>
                <h1 className="display-title">Group: {group.name}</h1>
                <p className="muted-copy">{group.description}</p>
              </div>
              <div className="stack-sm stack-sm--align-end">
                {!group.viewerRole && group.visibility === "public" && viewer ? (
                  <button className="button-primary" onClick={() => joinMutation.mutate()} type="button">
                    Join group
                  </button>
                ) : null}
                {group.viewerCanCreateMeeting ? (
                  <a className="button-secondary" href="#create-meeting">
                    Create meeting
                  </a>
                ) : null}
              </div>
            </div>

            <div className="form-actions form-actions--start">
              {group.activityLabel ? <span className="badge-invert">{group.activityLabel}</span> : null}
              <span className="badge">{members.length} members</span>
              <span className="badge-outline">Role: {group.viewerRole ?? "guest"}</span>
            </div>
          </PanelCard>

          <div className="detail-shell">
            <section className="stack-md">
              <PanelCard className="panel-card--highlight stack-md">
                <div className="detail-grid detail-grid--two">
                  <div className="terminal-item">
                    <p className="terminal-item__meta">Visibility</p>
                    <p className="terminal-item__title">{group.visibility}</p>
                  </div>
                  <div className="terminal-item">
                    <p className="terminal-item__meta">Scheduled meetings</p>
                    <p className="terminal-item__title">{meetings.length}</p>
                  </div>
                </div>
              </PanelCard>

              {group.viewerCanEditGroup ? (
                <PanelCard className="stack-md">
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
                </PanelCard>
              ) : null}

              {group.viewerCanCreateMeeting ? (
                <PanelCard className="stack-md" id="create-meeting">
                  <div>
                    <p className="eyebrow">Create meeting</p>
                    <h2 className="section-title">Launch a one-time or weekly session</h2>
                  </div>
                  <MeetingForm
                    groups={groupsQuery.data?.groups ?? []}
                    onSubmit={async (payload) => createMeetingMutation.mutateAsync(payload)}
                  />
                </PanelCard>
              ) : null}

              <PostBoard
                buttonLabel="Post to group"
                canPost={Boolean(group.viewerRole)}
                emptyLabel="No group posts yet."
                onSubmit={async (content) => postMutation.mutateAsync(content)}
                posts={posts}
                title={`${group.name} internal board`}
              />
            </section>

            <aside className="stack-md">
              <PanelCard className="stack-md">
                <div>
                  <p className="eyebrow">Members</p>
                  <h2 className="detail-title">Roster</h2>
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
              </PanelCard>

              {meetings.length > 0 ? (
                <PanelCard className="stack-md">
                  <div>
                    <p className="eyebrow">Session links</p>
                    <h2 className="detail-title">Open meetings</h2>
                  </div>

                  <div className="stack-sm scroll-stack">
                    {meetings.slice(0, 6).map((meeting) => (
                      <Link
                        className="terminal-item terminal-item--link"
                        key={meeting.id}
                        state={groupNavigationState}
                        to={`/meetings/${meeting.id}`}
                      >
                        <div className="terminal-item__row">
                          <div>
                            <p className="terminal-item__title">{meeting.title}</p>
                            <p className="terminal-item__meta">{formatDateTime(meeting.startsAt)}</p>
                          </div>
                          <span className="badge-outline">{meeting.locationName}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </PanelCard>
              ) : null}

              {group.viewerCanManageMembers ? (
                <PanelCard className="stack-md">
                  <div className="terminal-item__row">
                    <div>
                      <p className="eyebrow">Invite codes</p>
                      <h2 className="detail-title">Private-group access</h2>
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
                </PanelCard>
              ) : null}
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}
