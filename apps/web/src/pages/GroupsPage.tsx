import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { ViewerSummary } from "../../../../packages/shared/src";
import { GroupForm } from "../components/GroupForm";
import { PanelCard } from "../components/PanelCard";
import { createGroup, getGroups } from "../lib/api";
import { queryClient } from "../lib/query-client";

export function GroupsPage({ viewer }: { viewer: ViewerSummary | null }) {
  const groupsQuery = useQuery({
    queryFn: getGroups,
    queryKey: ["groups"],
  });
  const createGroupMutation = useMutation({
    mutationFn: createGroup,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid gap-5 lg:grid-cols-[0.65fr,1.35fr]">
        <PanelCard className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-500">
            Group setup
          </p>
          <h1 className="text-3xl font-semibold text-stone-900">Public communities and private crews</h1>
          <p className="text-sm leading-7 text-stone-600">
            Public groups are open to join immediately. Private groups stay map-visible only to members and use invite codes to onboard new players.
          </p>
          {viewer ? (
            <GroupForm onSubmit={async (payload) => createGroupMutation.mutateAsync(payload)} />
          ) : (
            <p className="rounded-3xl border border-dashed border-stone-200 bg-stone-50 px-4 py-5 text-sm text-stone-500">
              Sign in to create a group.
            </p>
          )}
        </PanelCard>

        <div className="grid gap-4 md:grid-cols-2">
          {(groupsQuery.data?.groups ?? []).map((group) => (
            <PanelCard className="flex flex-col justify-between" key={group.id}>
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-500">
                      {group.visibility}
                    </p>
                    <h2 className="mt-1 text-2xl font-semibold text-stone-900">{group.name}</h2>
                  </div>
                  <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">
                    {group.memberCount} members
                  </span>
                </div>
                <p className="mt-3 text-sm leading-7 text-stone-600">{group.description}</p>
                {group.activityLabel ? (
                  <p className="mt-4 text-sm font-medium text-orange-600">{group.activityLabel}</p>
                ) : null}
              </div>
              <div className="mt-5 flex items-center justify-between gap-4">
                <p className="text-xs uppercase tracking-[0.25em] text-stone-400">
                  {group.viewerRole ? `Your role: ${group.viewerRole}` : "Browseable"}
                </p>
                <Link className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-900 hover:text-stone-900" to={`/groups/${group.id}`}>
                  Open group
                </Link>
              </div>
            </PanelCard>
          ))}
        </div>
      </div>
    </div>
  );
}
