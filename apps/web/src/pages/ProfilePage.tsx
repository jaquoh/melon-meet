import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarDays, Users } from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import type { ViewerSummary } from "../../../../packages/shared/src";
import type { ThemeMode } from "../App";
import { EventTimeline } from "../components/EventTimeline";
import { GroupForm } from "../components/GroupForm";
import { MeetingForm } from "../components/MeetingForm";
import { ProfileForm } from "../components/ProfileForm";
import { WorkspaceShell } from "../components/WorkspaceShell";
import { createGroup, createMeeting, deleteProfile, getGroups, getProfile, updateProfile } from "../lib/api";
import { resolveNavigationState } from "../lib/navigation";
import { queryClient } from "../lib/query-client";

export function ProfilePage({
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
  const { profileId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [composeMode, setComposeMode] = useState<"group" | "session" | null>(null);

  const profileQuery = useQuery({
    queryFn: () => getProfile(profileId),
    queryKey: ["profile", profileId],
  });
  const groupsQuery = useQuery({
    enabled: viewer?.id === profileId,
    queryFn: getGroups,
    queryKey: ["groups"],
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => updateProfile(profileId, payload),
    onSuccess: async () => {
      setEditing(false);
      await queryClient.invalidateQueries({ queryKey: ["profile", profileId] });
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteProfile(profileId),
  });
  const createGroupMutation = useMutation({
    mutationFn: createGroup,
  });
  const createMeetingMutation = useMutation({
    mutationFn: createMeeting,
  });

  if (profileQuery.isLoading) {
    return <div className="loading-shell">Loading profile...</div>;
  }

  if (profileQuery.isError || !profileQuery.data) {
    return <div className="error-shell">{profileQuery.error?.message ?? "Profile not found."}</div>;
  }

  const ownProfile = viewer?.id === profileId;
  const closeTarget = resolveNavigationState(location.state, "/map", "Map");

  async function handleCreateMeeting(payload: Record<string, unknown>) {
    const { seriesDates, ...basePayload } = payload as Record<string, unknown> & {
      groupId?: string;
      seriesDates?: Array<{ endsAt: string; startsAt: string }>;
    };

    if (!seriesDates || seriesDates.length === 0) {
      const response = await createMeetingMutation.mutateAsync(basePayload);
      navigate(response.meetingId ? `/sessions/${response.meetingId}` : "/sessions");
      return;
    }

    const sortedDates = [...seriesDates].sort(
      (left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
    );
    let firstMeetingId: string | undefined;
    for (const slot of sortedDates) {
      const response = await createMeetingMutation.mutateAsync({
        ...basePayload,
        endsAt: slot.endsAt,
        startsAt: slot.startsAt,
      });
      firstMeetingId = firstMeetingId ?? response.meetingId;
    }
    navigate(firstMeetingId ? `/sessions/${firstMeetingId}` : "/sessions");
  }

  return (
    <WorkspaceShell
      center={
        <div className="workspace-detail-scroll">
          <div className="stack-panel">
          {profileQuery.data.profileIsPrivate ? (
            <div className="detail-card">
              <span className="panel-caption">Profile</span>
              <h2>User profile is private</h2>
            </div>
          ) : editing ? (
            <>
              <div className="screen-heading">
                <h2 className="screen-heading__title">Edit: Profile</h2>
              </div>
              <ProfileForm formId="profile-edit-form" onSubmit={async (payload) => updateMutation.mutateAsync(payload)} profile={profileQuery.data.profile} />
              <div className="editor-action-row">
                <button className="button-danger editor-action-row__danger" onClick={() => deleteMutation.mutate()} type="button">
                  Delete profile
                </button>
                <div className="editor-action-row__right">
                  <button className="button-secondary" onClick={() => setEditing(false)} type="button">
                    Cancel
                  </button>
                  <button className="button-primary" form="profile-edit-form" type="submit">
                    Save profile
                  </button>
                </div>
              </div>
            </>
          ) : composeMode === "group" && ownProfile ? (
            <>
              <div className="screen-heading">
                <h2 className="screen-heading__title">Create: Group</h2>
              </div>
              <GroupForm
                formId="profile-create-group-form"
                onSubmit={async (payload) => {
                  const response = await createGroupMutation.mutateAsync(payload);
                  navigate(`/groups/${response.groupId}`);
                }}
              />
              <div className="editor-action-row">
                <div className="editor-action-row__right">
                  <button className="button-secondary" onClick={() => setComposeMode(null)} type="button">
                    Cancel
                  </button>
                  <button className="button-primary" form="profile-create-group-form" type="submit">
                    Create group
                  </button>
                </div>
              </div>
            </>
          ) : composeMode === "session" && ownProfile ? (
            <>
              <div className="screen-heading">
                <h2 className="screen-heading__title">Create: Session</h2>
              </div>
              <MeetingForm formId="profile-create-session-form" groups={groupsQuery.data?.groups ?? []} onSubmit={handleCreateMeeting} />
              <div className="editor-action-row">
                <div className="editor-action-row__right">
                  <button className="button-secondary" onClick={() => setComposeMode(null)} type="button">
                    Cancel
                  </button>
                  <button className="button-primary" form="profile-create-session-form" type="submit">
                    Create session
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="screen-heading">
                <h2 className="screen-heading__title">Profile</h2>
              </div>
              <section className="player-card">
                <div className="player-card__frame">
                  <div className="player-card__art">
                    {profileQuery.data.profile.avatarUrl ? (
                      <img alt={profileQuery.data.profile.displayName} className="player-card__avatar" src={profileQuery.data.profile.avatarUrl} />
                    ) : (
                      <div className="player-card__avatar player-card__avatar--fallback">
                        {profileQuery.data.profile.displayName.slice(0, 1)}
                      </div>
                    )}
                  </div>
                  <div className="player-card__content">
                    <div className="player-card__top">
                      <div>
                        <p className="eyebrow">Player card</p>
                        <h1 className="display-title typewriter-title">{profileQuery.data.profile.displayName}</h1>
                      </div>
                      <span className="badge-invert">{profileQuery.data.profile.homeArea || "Berlin"}</span>
                    </div>
                    <p className="player-card__bio">{profileQuery.data.profile.bio || "No bio yet."}</p>
                    <div className="mini-meta-row">
                      {profileQuery.data.profile.email ? <span className="mini-chip">{profileQuery.data.profile.email}</span> : null}
                      <span className="mini-chip">{profileQuery.data.memberships.length} groups</span>
                      <span className="mini-chip">{profileQuery.data.attending.length} attending</span>
                      <span className="mini-chip">{profileQuery.data.responsible.length} responsible</span>
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}
          </div>
        </div>
      }
      detailCloseTo={closeTarget.fromPath}
      left={
        <div className="stack-panel">
          {ownProfile ? (
            <>
              <button className="button-primary" onClick={() => { setComposeMode(null); setEditing((current) => !current); }} type="button">
                {editing ? "Close edit" : "Edit profile"}
              </button>
              <button className="button-secondary" onClick={() => { setEditing(false); setComposeMode("group"); }} type="button">
                <Users size={14} strokeWidth={2} />
                Create group
              </button>
              <button className="button-secondary" onClick={() => { setEditing(false); setComposeMode("session"); }} type="button">
                <CalendarDays size={14} strokeWidth={2} />
                Create session
              </button>
            </>
          ) : null}
          {profileQuery.data.memberships.length > 0 ? <div className="list-divider" /> : null}
          <div className="stack-sm">
            <p className="panel-caption detail-subheading">My Groups</p>
            {profileQuery.data.memberships.map((membership) => (
              <Link className="mini-link" key={membership.id} to={`/groups/${membership.id}`}>
                {membership.name} · {membership.role}
              </Link>
            ))}
          </div>
        </div>
      }
      leftHeader={undefined}
      onLogOut={onLogOut}
      right={
        <div className="stack-panel">
          <EventTimeline
            contextLabel={profileQuery.data.profile.displayName}
            emptyLabel="No attending sessions."
            heading="Attending sessions"
            meetings={profileQuery.data.attending}
          />
          <EventTimeline
            contextLabel={profileQuery.data.profile.displayName}
            emptyLabel="No responsible sessions."
            heading="Responsible sessions"
            meetings={profileQuery.data.responsible}
          />
        </div>
      }
      rightHeader={undefined}
      theme={theme}
      title={`Profile: ${profileQuery.data.profile.displayName}`}
      toggleTheme={toggleTheme}
      viewer={viewer}
    />
  );
}
