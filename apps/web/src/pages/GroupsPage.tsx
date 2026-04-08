import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import type { MeetingSummary, ViewerSummary } from "../../../../packages/shared/src";
import { GroupForm } from "../components/GroupForm";
import { EventTimeline } from "../components/EventTimeline";
import { createGroup, getGroups, getMap } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { createNavigationState } from "../lib/navigation";
import { queryClient } from "../lib/query-client";

const DISCOVERY_BOUNDS = {
  east: 180,
  north: 90,
  openOnly: false,
  pricing: "all" as const,
  south: -90,
  startAt: new Date().toISOString(),
  west: -180,
};

export function GroupsPage({ viewer }: { viewer: ViewerSummary | null }) {
  const location = useLocation();
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const groupsQuery = useQuery({
    queryFn: getGroups,
    queryKey: ["groups"],
  });
  const sessionsQuery = useQuery({
    queryFn: () => getMap(DISCOVERY_BOUNDS),
    queryKey: ["groups", "public-sessions"],
  });
  const createGroupMutation = useMutation({
    mutationFn: createGroup,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });

  const groupSessions = useMemo(() => {
    return (sessionsQuery.data?.meetings ?? []).reduce<Record<string, MeetingSummary[]>>((accumulator, meeting) => {
      const current = accumulator[meeting.groupId] ?? [];
      accumulator[meeting.groupId] = [...current, meeting];
      return accumulator;
    }, {});
  }, [sessionsQuery.data?.meetings]);

  const allGroups = groupsQuery.data?.groups ?? [];
  const memberGroups = viewer
    ? allGroups
        .filter((group) => group.viewerRole)
        .sort((left, right) => {
          if (left.visibility !== right.visibility) {
            return left.visibility === "private" ? -1 : 1;
          }
          return left.name.localeCompare(right.name);
        })
    : [];
  const publicGroups = allGroups.filter((group) => group.visibility === "public" && !group.viewerRole);
  const navState = createNavigationState(location, "Groups");
  const timelineMeetings = expandedGroupId ? groupSessions[expandedGroupId] ?? [] : sessionsQuery.data?.meetings ?? [];
  const expandedGroup = allGroups.find((group) => group.id === expandedGroupId) ?? null;

  function renderGroupList(groupList: typeof allGroups, memberSection = false) {
    return (
      <div className="board-column__list">
        {groupList.length === 0 ? (
          <p className="empty-state">
            {memberSection ? "No member groups yet. Join a public group or create one." : "No public groups are visible right now."}
          </p>
        ) : (
          groupList.map((group) => {
            const sessions = groupSessions[group.id] ?? [];
            const hasPublicSessions = sessions.some((meeting) => meeting.groupVisibility === "public");
            const expanded = expandedGroupId === group.id;

            return (
              <article className="group-listing" key={group.id}>
                <div className="group-listing__top">
                  <div className="stack-sm">
                    <p className="eyebrow">{group.visibility}</p>
                    <h3 className="section-title">{group.name}</h3>
                  </div>
                  <div className="compact-badges">
                    <span className={hasPublicSessions ? "badge-accent" : "badge-outline"}>
                      {hasPublicSessions ? `${sessions.length} sessions` : "No public sessions"}
                    </span>
                    {group.viewerRole ? <span className="badge">{group.viewerRole}</span> : null}
                  </div>
                </div>

                <p className="muted-copy">{group.description}</p>

                <div className="group-listing__actions">
                  <Link className="button-primary" state={navState} to={`/groups/${group.id}`}>
                    Open group
                  </Link>
                  {sessions.length > 0 ? (
                    <button
                      className="button-secondary"
                      onClick={() => setExpandedGroupId((current) => (current === group.id ? null : group.id))}
                      type="button"
                    >
                      {expanded ? "Hide sessions" : "See sessions"}
                    </button>
                  ) : null}
                </div>

                {expanded && sessions.length > 0 ? (
                  <div className="stack-sm scroll-stack">
                    {sessions.slice(0, 6).map((meeting) => (
                      <Link
                        className="terminal-item terminal-item--link"
                        key={meeting.id}
                        state={navState}
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
                ) : null}
              </article>
            );
          })
        )}
      </div>
    );
  }

  return (
    <div className="page-wrap page-wrap--workspace groups-page">
      <section className="workspace-board">
        <aside className="board-column">
          <div className="board-column__header">
            <div>
              <p className="eyebrow">{expandedGroup ? "Group" : "At a glance"}</p>
              <h2 className="section-title typewriter-title">{expandedGroup ? expandedGroup.name : "At a glance"}</h2>
            </div>
            {expandedGroup ? (
              <button className="button-secondary button-inline" onClick={() => setExpandedGroupId(null)} type="button">
                Close
              </button>
            ) : (
              <span className="badge-outline">{allGroups.length} groups</span>
            )}
          </div>

          <div className="board-column__body">
            <div className="board-column__section">
              <p className="muted-copy">
                {expandedGroup
                  ? expandedGroup.description
                  : "Create a public group for open discovery or a private group when the crew should stay invite-only."}
              </p>

              {expandedGroup ? (
                <div className="board-column__actions">
                  <Link className="button-primary" state={navState} to={`/groups/${expandedGroup.id}`}>
                    Open page
                  </Link>
                </div>
              ) : viewer ? (
                <GroupForm onSubmit={async (payload) => createGroupMutation.mutateAsync(payload)} />
              ) : (
                <div className="stack-sm">
                  <p className="empty-state">Sign in to create groups and manage private crews.</p>
                  <div className="form-actions form-actions--start">
                    <Link className="button-primary button-inline" to="/auth">
                      Sign in
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <div className="board-column__section">
              <div className="metrics-grid metrics-grid--compact">
                <div className="metric-box">
                  <p className="metric-box__value">{memberGroups.length}</p>
                  <p className="metric-box__label">Your groups</p>
                </div>
                <div className="metric-box">
                  <p className="metric-box__value">{publicGroups.length}</p>
                  <p className="metric-box__label">Public groups</p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <div className="board-column">
          <div className="board-column__header">
            <div>
              <p className="eyebrow">Groups</p>
              <h2 className="section-title typewriter-title">Browse open communities</h2>
            </div>
          </div>

          <div className="board-column__body">
            {viewer ? (
              <>
                {renderGroupList(memberGroups, true)}
                <div className="board-column__separator">
                  <span className="board-column__separator-label">Public groups</span>
                </div>
              </>
            ) : null}
            {renderGroupList(
              publicGroups.length > 0 || !viewer ? publicGroups : allGroups.filter((group) => group.visibility === "public"),
            )}
          </div>
        </div>

        <aside className="board-column">
          <div className="board-column__header">
            <div>
              <p className="eyebrow">Upcoming sessions</p>
              <h2 className="section-title typewriter-title">
                {expandedGroup ? `${expandedGroup.name} sessions` : "Public sessions"}
              </h2>
            </div>
            <span className="badge">{timelineMeetings.length} sessions</span>
          </div>

          <div className="board-column__body">
            <EventTimeline
              contextLabel="Groups"
              emptyLabel={expandedGroup ? "No public sessions are attached to this group yet." : "No public sessions are visible right now."}
              heading={expandedGroup ? `${expandedGroup.name} sessions` : "Public sessions"}
              meetings={timelineMeetings}
              secondaryMeta={expandedGroup ? "location" : "group-and-location"}
              showHeader={false}
              showGroupLabel={!expandedGroup}
              variant="embedded"
            />
          </div>
        </aside>
      </section>
    </div>
  );
}
