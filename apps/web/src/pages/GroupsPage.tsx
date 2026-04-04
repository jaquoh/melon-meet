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
    <div className="page-wrap">
      <div className="section-grid section-grid--groups">
        <section className="stack-md">
          <PanelCard className="panel-card--highlight stack-sm">
            <p className="eyebrow">Groups index</p>
            <h1 className="display-title">Public communities and private crews.</h1>
            <p className="muted-copy">
              Browse open groups, see where you already belong, and jump directly into the boards that
              matter.
            </p>
          </PanelCard>

          <div className="card-grid card-grid--tight">
            {(groupsQuery.data?.groups ?? []).map((group) => (
              <PanelCard className="stack-sm" key={group.id}>
                <div className="terminal-item__row">
                  <div className="stack-sm">
                    <p className="eyebrow">{group.visibility}</p>
                    <h2 className="section-title">{group.name}</h2>
                  </div>
                  <span className="badge">{group.memberCount} members</span>
                </div>

                <p className="muted-copy">{group.description}</p>

                <div className="compact-badges">
                  {group.activityLabel ? <span className="badge-outline">{group.activityLabel}</span> : null}
                  <span className="badge-outline">
                    {group.viewerRole ? `Role: ${group.viewerRole}` : "Publicly browseable"}
                  </span>
                </div>

                <div className="form-actions form-actions--start">
                  <Link className="button-secondary" to={`/groups/${group.id}`}>
                    Open group
                  </Link>
                </div>
              </PanelCard>
            ))}
          </div>
        </section>

        <aside className="stack-md">
          <PanelCard className="stack-md">
            <div>
              <p className="eyebrow">Create group</p>
              <h2 className="section-title">Start a new board</h2>
            </div>

            <p className="muted-copy">
              Public groups are open to join immediately. Private groups stay visible only to members and
              use invite codes to onboard new players.
            </p>

            {viewer ? (
              <GroupForm onSubmit={async (payload) => createGroupMutation.mutateAsync(payload)} />
            ) : (
              <div className="stack-sm">
                <p className="empty-state">Sign in to create a group.</p>
                <div className="form-actions form-actions--start">
                  <Link className="button-primary button-inline" to="/auth">
                    Sign in
                  </Link>
                </div>
              </div>
            )}
          </PanelCard>
        </aside>
      </div>
    </div>
  );
}
