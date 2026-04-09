import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ExternalLink, Image as ImageIcon, Shield, Users } from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import type { ViewerSummary } from "../../../../packages/shared/src";
import type { ThemeMode } from "../App";
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
  const hasLeftActions = Boolean(
    (!group.viewerRole && viewer) || group.viewerCanEditGroup || group.viewerCanManageMembers || group.messengerUrl,
  );

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
              <section className="session-detail-main">
                <p className="eyebrow">{`${group.visibility} group`}</p>
                <h1 className="display-title typewriter-title session-detail-main__title">{group.name}</h1>
                <div className="session-detail-main__hero-row">
                  <div className={`detail-hero__media ${group.heroImageUrl ? "has-image" : ""}`.trim()}>
                    {group.heroImageUrl ? <img alt={group.name} className="detail-hero__image" src={group.heroImageUrl} /> : null}
                    <div className="detail-hero__fallback" aria-hidden={Boolean(group.heroImageUrl)}>
                      <ImageIcon size={24} strokeWidth={1.8} />
                    </div>
                  </div>
                  <div className="session-detail-main__summary">
                    <p className="detail-hero__description">{group.description || "No description yet."}</p>
                  </div>
                </div>
              </section>
              <div className="detail-fact-grid detail-fact-grid--session">
                <article className="detail-fact-card">
                  <span className="panel-caption">Activity</span>
                  <strong className="detail-fact-card__value--mono">{group.activityLabel || "Beach volleyball"}</strong>
                </article>
                <article className="detail-fact-card">
                  <span className="panel-caption">Upcoming sessions</span>
                  <strong className="detail-fact-card__value--mono">{meetings.length}</strong>
                </article>
                <article className="detail-fact-card">
                  <span className="panel-caption">Members</span>
                  <strong className="detail-fact-card__value--mono">{members.length}</strong>
                </article>
                <article className="detail-fact-card">
                  <span className="panel-caption">Owner</span>
                  <strong className="detail-fact-card__value--mono">
                    {members.find((member) => member.role === "owner")?.user.displayName ?? "Unknown"}
                  </strong>
                </article>
                <article className="detail-fact-card">
                  <span className="panel-caption">Visibility</span>
                  <strong className="detail-fact-card__value--mono">{group.visibility}</strong>
                </article>
              </div>
              <PostBoard
                buttonLabel="Post to group"
                canPost={Boolean(group.viewerRole)}
                emptyLabel="No posts yet."
                onSubmit={async (content) => postMutation.mutateAsync(content)}
                posts={posts}
                title="Pin board Group Updates"
              />
            </>
          )}
          </div>
        </div>
      }
      detailCloseTo={backTarget.fromPath}
      left={
        <div className="stack-panel">
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
            </>
          ) : null}
          {group.messengerUrl ? (
            <a className="button-secondary" href={group.messengerUrl} rel="noreferrer" target="_blank">
              <ExternalLink size={14} strokeWidth={2} />
              Open messenger
            </a>
          ) : null}
          {hasLeftActions ? <div className="list-divider" /> : null}
          <section className="detail-section">
            <span className="panel-caption">Members</span>
            <div className="detail-link-list">
              {members.map((member) => (
                <Link className="mini-link" key={member.user.id} to={`/profile/${member.user.id}`}>
                  {member.user.displayName} · {member.role}
                </Link>
              ))}
            </div>
          </section>
          {group.viewerCanManageMembers ? (
            <>
              {inviteLinks.map((link) => (
                <section className="detail-section" key={link.id}>
                  <span className="panel-caption">Invite</span>
                  <strong className="detail-section__value">{link.code}</strong>
                </section>
              ))}
              {(requestsQuery.data?.requests ?? []).map((request) => (
                <section className="detail-section" key={request.id}>
                  <span className="panel-caption">Request</span>
                  <strong className="detail-section__value">{request.requester.displayName}</strong>
                  <p>{request.note || "No note"}</p>
                  <button className="button-primary" onClick={() => approveMutation.mutate(request.id)} type="button">
                    Approve
                  </button>
                </section>
              ))}
            </>
          ) : null}
        </div>
      }
      leftHeader={undefined}
      onLogOut={onLogOut}
      right={
        <div className="stack-panel">
          <EventTimeline
            contextLabel={group.name}
            emptyLabel="No sessions created by this group yet."
            heading="Upcoming sessions"
            meetings={meetings}
            secondaryMeta="location"
            showGroupLabel={false}
          />
        </div>
      }
      rightHeader={undefined}
      theme={theme}
      title={`Group: ${group.name}`}
      toggleTheme={toggleTheme}
      viewer={viewer}
    />
  );
}
