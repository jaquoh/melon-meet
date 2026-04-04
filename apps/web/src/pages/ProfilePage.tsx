import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import type { ViewerSummary } from "../../../../packages/shared/src";
import { PanelCard } from "../components/PanelCard";
import { ProfileForm } from "../components/ProfileForm";
import {
  acceptFriendRequest,
  deleteFriend,
  getMe,
  getProfile,
  sendFriendRequest,
  updateProfile,
} from "../lib/api";
import { queryClient } from "../lib/query-client";

export function ProfilePage({ viewer }: { viewer: ViewerSummary | null }) {
  const { profileId = "" } = useParams();
  const profileQuery = useQuery({
    queryFn: () => getProfile(profileId),
    queryKey: ["profile", profileId],
  });
  const meQuery = useQuery({
    queryFn: getMe,
    queryKey: ["me"],
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => updateProfile(profileId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile", profileId] }),
        queryClient.invalidateQueries({ queryKey: ["me"] }),
      ]);
    },
  });

  const friendMutation = useMutation({
    mutationFn: () => sendFriendRequest({ targetUserId: profileId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["profile", profileId] });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: (requestId: string) => acceptFriendRequest(requestId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      await queryClient.invalidateQueries({ queryKey: ["profile", profileId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (connectionId: string) => deleteFriend(connectionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      await queryClient.invalidateQueries({ queryKey: ["profile", profileId] });
    },
  });

  if (profileQuery.isLoading) {
    return <div className="loading-shell">Loading profile...</div>;
  }

  if (profileQuery.isError || !profileQuery.data) {
    return <div className="error-shell">{profileQuery.error?.message ?? "Profile not found."}</div>;
  }

  const ownProfile = viewer?.id === profileId;
  const incomingRequest = meQuery.data?.friends.find(
    (friend) => friend.id === profileQuery.data.friendship?.id && friend.direction === "incoming",
  );

  return (
    <div className="page-wrap">
      <div className="profile-grid">
        <section className="stack-md">
          <PanelCard className="panel-card--highlight stack-md">
            <div className="terminal-item__row">
              <div className="stack-sm">
                <p className="eyebrow">Player profile</p>
                <h1 className="display-title">{profileQuery.data.profile.displayName}</h1>
              </div>
              {profileQuery.data.profile.avatarUrl ? (
                <img
                  alt={profileQuery.data.profile.displayName}
                  className="profile-avatar"
                  src={profileQuery.data.profile.avatarUrl}
                />
              ) : null}
            </div>

            <p className="muted-copy">{profileQuery.data.profile.bio || "No bio yet."}</p>

            <div className="form-actions form-actions--start">
              <span className="badge">{profileQuery.data.profile.homeArea || "Berlin"}</span>
              {ownProfile ? <span className="badge-outline">{profileQuery.data.profile.email}</span> : null}
            </div>
          </PanelCard>

          {ownProfile ? (
            <PanelCard className="stack-md">
              <div>
                <p className="eyebrow">Edit profile</p>
                <h2 className="section-title">Keep your player card current</h2>
              </div>
              <ProfileForm
                onSubmit={async (payload) => updateMutation.mutateAsync(payload)}
                profile={profileQuery.data.profile}
              />
            </PanelCard>
          ) : null}
        </section>

        <aside className="stack-md">
          <PanelCard className="stack-md">
            <div>
              <p className="eyebrow">Profile details</p>
              <h2 className="detail-title">Snapshot</h2>
            </div>

            <div className="detail-grid detail-grid--two">
              <div className="terminal-item">
                <p className="terminal-item__meta">Home area</p>
                <p className="terminal-item__title">{profileQuery.data.profile.homeArea || "Berlin"}</p>
              </div>
              <div className="terminal-item">
                <p className="terminal-item__meta">Connection</p>
                <p className="terminal-item__title">
                  {profileQuery.data.friendship
                    ? `${profileQuery.data.friendship.status} link`
                    : ownProfile
                      ? "Your account"
                      : "No friend link"}
                </p>
              </div>
              {ownProfile ? (
                <div className="terminal-item field-full">
                  <p className="terminal-item__meta">Email</p>
                  <p className="terminal-item__title">{profileQuery.data.profile.email}</p>
                </div>
              ) : null}
            </div>

            {!ownProfile && viewer ? (
              <div className="form-actions form-actions--start">
                {profileQuery.data.friendship ? (
                  <>
                    {incomingRequest ? (
                      <button className="button-primary" onClick={() => acceptMutation.mutate(incomingRequest.id)} type="button">
                        Accept request
                      </button>
                    ) : null}
                    <button
                      className="button-secondary"
                      onClick={() => deleteMutation.mutate(profileQuery.data.friendship!.id)}
                      type="button"
                    >
                      Remove friend link
                    </button>
                  </>
                ) : (
                  <button className="button-primary" onClick={() => friendMutation.mutate()} type="button">
                    Add friend
                  </button>
                )}
              </div>
            ) : null}
          </PanelCard>

          {ownProfile ? (
            <PanelCard className="stack-md">
              <div>
                <p className="eyebrow">Friends</p>
                <h2 className="detail-title">Connections</h2>
              </div>

              <div className="stack-sm">
                {(meQuery.data?.friends ?? []).length === 0 ? (
                  <p className="empty-state">No friend links yet.</p>
                ) : (
                  meQuery.data?.friends.map((friend) => (
                    <div className="terminal-item" key={friend.id}>
                      <div className="terminal-item__row">
                        <div>
                          <p className="terminal-item__title">{friend.user.displayName}</p>
                          <p className="terminal-item__meta">
                            {friend.status} · {friend.direction}
                          </p>
                        </div>
                        {friend.status === "pending" && friend.direction === "incoming" ? (
                          <button className="button-primary" onClick={() => acceptMutation.mutate(friend.id)} type="button">
                            Accept
                          </button>
                        ) : (
                          <button className="button-secondary" onClick={() => deleteMutation.mutate(friend.id)} type="button">
                            Remove
                          </button>
                        )}
                      </div>
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
