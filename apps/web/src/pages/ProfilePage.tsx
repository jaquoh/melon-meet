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
    return <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">Loading profile...</div>;
  }

  if (profileQuery.isError || !profileQuery.data) {
    return <div className="mx-auto max-w-7xl px-4 py-10 text-red-600 sm:px-6 lg:px-8">{profileQuery.error?.message ?? "Profile not found."}</div>;
  }

  const ownProfile = viewer?.id === profileId;
  const incomingRequest = meQuery.data?.friends.find(
    (friend) => friend.id === profileQuery.data.friendship?.id && friend.direction === "incoming",
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid gap-5 xl:grid-cols-[1.05fr,0.95fr]">
        <section className="space-y-5">
          <PanelCard className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-500">
                  Player profile
                </p>
                <h1 className="mt-1 text-4xl font-semibold text-stone-900">
                  {profileQuery.data.profile.displayName}
                </h1>
              </div>
              {profileQuery.data.profile.avatarUrl ? (
                <img
                  alt={profileQuery.data.profile.displayName}
                  className="h-20 w-20 rounded-3xl object-cover"
                  src={profileQuery.data.profile.avatarUrl}
                />
              ) : null}
            </div>
            <p className="text-sm leading-7 text-stone-600">
              {profileQuery.data.profile.bio || "No bio yet."}
            </p>
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="rounded-full bg-stone-100 px-3 py-1 font-medium text-stone-600">
                {profileQuery.data.profile.homeArea || "Berlin"}
              </span>
              {ownProfile ? (
                <span className="rounded-full bg-stone-100 px-3 py-1 font-medium text-stone-600">
                  {profileQuery.data.profile.email}
                </span>
              ) : null}
            </div>

            {!ownProfile && viewer ? (
              <div className="flex flex-wrap gap-3">
                {profileQuery.data.friendship ? (
                  <>
                    {incomingRequest ? (
                      <button className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white" onClick={() => acceptMutation.mutate(incomingRequest.id)} type="button">
                        Accept request
                      </button>
                    ) : null}
                    <button className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700" onClick={() => deleteMutation.mutate(profileQuery.data.friendship!.id)} type="button">
                      Remove friend link
                    </button>
                  </>
                ) : (
                  <button className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white" onClick={() => friendMutation.mutate()} type="button">
                    Add friend
                  </button>
                )}
              </div>
            ) : null}
          </PanelCard>

          {ownProfile ? (
            <PanelCard>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-500">
                Edit profile
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-stone-900">Keep your player card current</h2>
              <div className="mt-4">
                <ProfileForm
                  onSubmit={async (payload) => updateMutation.mutateAsync(payload)}
                  profile={profileQuery.data.profile}
                />
              </div>
            </PanelCard>
          ) : null}
        </section>

        <aside className="space-y-5">
          {ownProfile ? (
            <PanelCard>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-500">
                Friends
              </p>
              <div className="mt-4 space-y-3">
                {(meQuery.data?.friends ?? []).length === 0 ? (
                  <p className="rounded-3xl border border-dashed border-stone-200 bg-stone-50 px-4 py-5 text-sm text-stone-500">
                    No friend links yet.
                  </p>
                ) : (
                  meQuery.data?.friends.map((friend) => (
                    <div className="rounded-3xl border border-stone-200/80 bg-stone-50/80 px-4 py-4" key={friend.id}>
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-medium text-stone-900">{friend.user.displayName}</p>
                          <p className="text-sm text-stone-500">
                            {friend.status} · {friend.direction}
                          </p>
                        </div>
                        {friend.status === "pending" && friend.direction === "incoming" ? (
                          <button className="rounded-full bg-stone-900 px-3 py-2 text-xs font-medium text-white" onClick={() => acceptMutation.mutate(friend.id)} type="button">
                            Accept
                          </button>
                        ) : (
                          <button className="rounded-full border border-stone-300 px-3 py-2 text-xs font-medium text-stone-700" onClick={() => deleteMutation.mutate(friend.id)} type="button">
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
