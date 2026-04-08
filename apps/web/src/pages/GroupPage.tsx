import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ExternalLink, Shield, Users } from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import type { ViewerSummary } from "../../../../packages/shared/src";
import type { ThemeMode } from "../App";
import { DetailHero } from "../components/DetailHero";
import { EventTimeline } from "../components/EventTimeline";
import { GroupForm } from "../components/GroupForm";
import { PostBoard } from "../components/PostBoard";
import { WorkspaceShell } from "../components/WorkspaceShell";
import {
  approveMembershipRequest,
  createGroupPost,
  createInviteLink,
  createMembershipRequest,
  deleteGroup,
  getGroup,
  getMembershipRequests,
  updateGroup,
} from "../lib/api";
import { resolveNavigationState } from "../lib/navigation";
import { queryClient } from "../lib/query-client";

export function GroupPage({
  onLogOut,
  theme,
  toggleTheme,
  viewer,
}: {
  onLogOut: () => void;
  theme: ThemeMode;
  toggleTheme: () => void;
  viewer: ViewerSummary | null;
}) {
  const { groupId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);

  const groupQuery = useQuery({
    queryFn: () => getGroup(groupId),
    queryKey: ["group", groupId],
  });

  const requestsQuery = useQuery({
    enabled: groupQuery.data?.group.viewerCanManageMembers ?? false,
    queryFn: () => getMembershipRequests(groupId),
    queryKey: ["group", groupId, "requests"],
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => updateGroup(groupId, payload),
    onSuccess: async () => {
      setEditing(false);
      await queryClient.invalidateQueries({ queryKey: ["group", groupId] });
      await queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });
  const postMutation = useMutation({
    mutationFn: (content: string) => createGroupPost(groupId, content),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["group", groupId] });
    },
  });
  const requestMutation = useMutation({
    mutationFn: () => createMembershipRequest(groupId),
  });
  const inviteMutation = useMutation({
    mutationFn: () => createInviteLink(groupId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["group", groupId] });
    },
  });
  const approveMutation = useMutation({
    mutationFn: (requestId: string) => approveMembershipRequest(groupId, requestId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["group", groupId, "requests"] });
      await queryClient.invalidateQueries({ queryKey: ["group", groupId] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteGroup(groupId),
  });

  if (groupQuery.isLoading) {
    return <div className="loading-shell">Loading group...</div>;
  }

  if (groupQuery.isError || !groupQuery.data) {
    return <div className="error-shell">{groupQuery.error?.message ?? "Group not found."}</div>;
  }

  const { group, inviteLinks, meetings, members, posts } = groupQuery.data;
  const backTarget = resolveNavigationState(location.state, "/groups", "Groups");

  async function handleDelete() {
    if (!window.confirm("Delete this group? This cannot be undone.")) {
      return;
    }
    await deleteMutation.mutateAsync();
    navigate(backTarget.fromPath);
  }

  return (
    <WorkspaceShell
      center={
        <div className="workspace-detail-scroll">
          <div className="stack-panel">
          {editing ? (
            <>
              <div className="screen-heading">
                <h2 className="screen-heading__title">Edit: Group</h2>
              </div>
              <GroupForm
                formId="group-edit-form"
                initialValues={{
                  activityLabel: group.activityLabel,
                  description: group.description,
                  heroImageUrl: group.heroImageUrl,
                  messengerUrl: group.messengerUrl,
                  name: group.name,
                  slug: group.slug,
                  visibility: group.visibility,
                }}
                onSubmit={async (payload) => updateMutation.mutateAsync(payload)}
              />
              <div className="editor-action-row">
                <button className="button-danger editor-action-row__danger" onClick={handleDelete} type="button">
                  Delete group
                </button>
                <div className="editor-action-row__right">
                  <button className="button-secondary" onClick={() => setEditing(false)} type="button">
                    Cancel
                  </button>
                  <button className="button-primary" form="group-edit-form" type="submit">
                    Save group
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <DetailHero
                description={group.description}
                eyebrow={`${group.visibility} group`}
                imageUrl={group.heroImageUrl}
                meta={
                  <>
                    {group.activityLabel ? <span className="mini-chip">{group.activityLabel}</span> : null}
                    <span className="mini-chip">{members.length} members</span>
                    <span className="mini-chip">{meetings.length} upcoming</span>
                  </>
                }
                title={group.name}
              />
              <div className="detail-fact-grid">
                <article className="detail-fact-card">
                  <span className="panel-caption">Visibility</span>
                  <strong>{group.visibility}</strong>
                </article>
                <article className="detail-fact-card">
                  <span className="panel-caption">Members</span>
                  <strong>{members.length}</strong>
                </article>
                <article className="detail-fact-card">
                  <span className="panel-caption">Upcoming sessions</span>
                  <strong>{meetings.length}</strong>
                </article>
              </div>
              <PostBoard
                buttonLabel="Post to group"
                canPost={Boolean(group.viewerRole)}
                emptyLabel="No posts yet."
                onSubmit={async (content) => postMutation.mutateAsync(content)}
                posts={posts}
                title="Pin board"
              />
            </>
          )}
          </div>
        </div>
      }
      detailCloseTo={backTarget.fromPath}
      left={
        <div className="stack-panel">
          <div className="detail-card detail-card--compact">
            <span className="panel-caption">Owner</span>
            <strong>{members.find((member) => member.role === "owner")?.user.displayName ?? "Unknown"}</strong>
          </div>
          <div className="detail-card detail-card--compact">
            <span className="panel-caption">Members</span>
            <div className="detail-link-list">
              {members.map((member) => (
                <Link className="mini-link" key={member.user.id} to={`/profile/${member.user.id}`}>
                  {member.user.displayName} · {member.role}
                </Link>
              ))}
            </div>
          </div>
          {group.messengerUrl ? (
            <a className="button-secondary" href={group.messengerUrl} rel="noreferrer" target="_blank">
              <ExternalLink size={14} strokeWidth={2} />
              Open messenger
            </a>
          ) : null}
          {!group.viewerRole && viewer ? (
            <button className="button-primary" onClick={() => requestMutation.mutate()} type="button">
              <Users size={14} strokeWidth={2} />
              Request membership
            </button>
          ) : null}
          {group.viewerCanEditGroup ? (
            <button className="button-secondary" onClick={() => setEditing((current) => !current)} type="button">
              <Shield size={14} strokeWidth={2} />
              {editing ? "Close edit" : "Edit group"}
            </button>
          ) : null}
          {group.viewerCanManageMembers ? (
            <>
              <button className="button-secondary" onClick={() => inviteMutation.mutate()} type="button">
                <ExternalLink size={14} strokeWidth={2} />
                Create invite link
              </button>
              {inviteLinks.map((link) => (
                <div className="detail-card detail-card--compact" key={link.id}>
                  <span className="panel-caption">Invite</span>
                  <strong>{link.code}</strong>
                </div>
              ))}
              {(requestsQuery.data?.requests ?? []).map((request) => (
                <div className="detail-card detail-card--compact" key={request.id}>
                  <span className="panel-caption">Request</span>
                  <strong>{request.requester.displayName}</strong>
                  <p>{request.note || "No note"}</p>
                  <button className="button-primary" onClick={() => approveMutation.mutate(request.id)} type="button">
                    Approve
                  </button>
                </div>
              ))}
            </>
          ) : null}
        </div>
      }
      leftHeader={undefined}
      onLogOut={onLogOut}
      right={
        <EventTimeline
          contextLabel={group.name}
          emptyLabel="No sessions created by this group yet."
          heading="Upcoming sessions"
          meetings={meetings}
          secondaryMeta="location"
          showGroupLabel={false}
        />
      }
      rightHeader={undefined}
      theme={theme}
      title={`Group: ${group.name}`}
      toggleTheme={toggleTheme}
      viewer={viewer}
    />
  );
}
