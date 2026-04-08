import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "react-router-dom";
import type { ViewerSummary } from "../../../../packages/shared/src";
import { EventTimeline } from "../components/EventTimeline";
import { MeetingForm } from "../components/MeetingForm";
import { createMeeting, getGroups, getVenue } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { createNavigationState, resolveNavigationState } from "../lib/navigation";
import { queryClient } from "../lib/query-client";

export function VenuePage({ viewer }: { viewer: ViewerSummary | null }) {
  const { venueId = "" } = useParams();
  const location = useLocation();
  const [showCreateForm, setShowCreateForm] = useState(false);

  const venueQuery = useQuery({
    queryFn: () => getVenue(venueId),
    queryKey: ["venue", venueId],
  });
  const groupsQuery = useQuery({
    queryFn: getGroups,
    queryKey: ["groups"],
  });

  const createMeetingMutation = useMutation({
    mutationFn: createMeeting,
    onSuccess: async () => {
      setShowCreateForm(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["map"] }),
        queryClient.invalidateQueries({ queryKey: ["map", "member-upcoming"] }),
        queryClient.invalidateQueries({ queryKey: ["venue", venueId] }),
      ]);
    },
  });

  if (venueQuery.isLoading) {
    return <div className="loading-shell">Loading venue...</div>;
  }

  if (venueQuery.isError || !venueQuery.data) {
    return <div className="error-shell">{venueQuery.error?.message ?? "Venue not found."}</div>;
  }

  const backTarget = resolveNavigationState(location.state, "/map", "Map");
  const venueNavigationState = createNavigationState(location, venueQuery.data.venue.name);
  const nextMeeting = venueQuery.data.meetings[0] ?? null;

  return (
    <div className="page-wrap page-wrap--workspace">
      <section className="workspace-board">
        <aside className="board-column">
          <div className="board-column__header">
            <div>
              <p className="eyebrow">Venue</p>
              <h2 className="section-title typewriter-title">Venue: {venueQuery.data.venue.name}</h2>
            </div>
            <Link className="button-secondary button-inline" to={backTarget.fromPath}>
              Back
            </Link>
          </div>

          <div className="board-column__body">
            <div className="board-column__section">
              <div className="compact-badges">
                <span className="badge-outline">{venueQuery.data.venue.pricing}</span>
                <span className="badge">{venueQuery.data.meetings.length} events</span>
              </div>
              <p className="muted-copy">{venueQuery.data.venue.description}</p>
              <p className="terminal-item__meta">{venueQuery.data.venue.address}</p>
            </div>

            <div className="board-column__section">
              <div className="board-column__actions">
                {nextMeeting ? (
                  <Link className="button-secondary" state={venueNavigationState} to={`/meetings/${nextMeeting.id}`}>
                    Open next session
                  </Link>
                ) : null}
                {viewer ? (
                  <button className="button-primary" onClick={() => setShowCreateForm((value) => !value)} type="button">
                    {showCreateForm ? "Hide create form" : "Create meeting here"}
                  </button>
                ) : (
                  <Link className="button-primary" to="/auth">
                    Sign in to create
                  </Link>
                )}
              </div>
            </div>
          </div>
        </aside>

        <div className="board-column">
          <div className="board-column__header">
            <div>
              <p className="eyebrow">Venue</p>
              <h2 className="section-title typewriter-title">Details and schedule</h2>
            </div>
            {venueQuery.data.venue.sourceUrl ? (
              <a className="button-secondary button-inline" href={venueQuery.data.venue.sourceUrl} rel="noreferrer" target="_blank">
                Source
              </a>
            ) : null}
          </div>

          <div className="board-column__body">
            <section className="workspace-section stack-md">
              <div className="workspace-section__header">
                <div className="stack-sm">
                  <p className="muted-copy">Keep venue details and creation flow in the middle, while upcoming sessions stay available on the right.</p>
                </div>
              </div>

              <div className="detail-grid detail-grid--two">
                <div className="terminal-item">
                  <p className="terminal-item__meta">Address</p>
                  <p className="terminal-item__title">{venueQuery.data.venue.address}</p>
                </div>
                <div className="terminal-item">
                  <p className="terminal-item__meta">Next event</p>
                  <p className="terminal-item__title">
                    {nextMeeting ? formatDateTime(nextMeeting.startsAt) : "Nothing scheduled"}
                  </p>
                </div>
              </div>

              {nextMeeting ? (
                <div className="terminal-item">
                  <div className="terminal-item__row">
                    <div>
                      <p className="terminal-item__meta">Next meeting here</p>
                      <p className="terminal-item__title">{nextMeeting.title}</p>
                    </div>
                    <span className={nextMeeting.viewerHasClaimed ? "badge-accent" : "badge-outline"}>
                      {nextMeeting.groupName}
                    </span>
                  </div>
                  <p className="terminal-item__meta">{formatDateTime(nextMeeting.startsAt)}</p>
                </div>
              ) : null}
            </section>

            {showCreateForm ? (
              <section className="workspace-section stack-md">
                <div>
                  <p className="eyebrow">Create meeting</p>
                  <h2 className="section-title">Launch a new session at this venue</h2>
                </div>

                {viewer ? (
                  <MeetingForm
                    groups={groupsQuery.data?.groups ?? []}
                    initialLocation={{
                      latitude: venueQuery.data.venue.latitude,
                      locationAddress: venueQuery.data.venue.address,
                      locationName: venueQuery.data.venue.name,
                      longitude: venueQuery.data.venue.longitude,
                      venueId: venueQuery.data.venue.id,
                    }}
                    onSubmit={async (payload) => {
                      await createMeetingMutation.mutateAsync(payload);
                    }}
                  />
                ) : null}
              </section>
            ) : null}
          </div>
        </div>

        <aside className="board-column">
          <div className="board-column__header">
            <div>
              <p className="eyebrow">Upcoming sessions</p>
              <h2 className="section-title typewriter-title">Venue events</h2>
            </div>
          </div>

          <div className="board-column__body">
            <EventTimeline
              contextLabel={venueQuery.data.venue.name}
              emptyLabel="No active meetings are scheduled for this venue."
              heading="Venue events"
              meetings={venueQuery.data.meetings}
              secondaryMeta="group"
              showHeader={false}
              variant="embedded"
            />
          </div>
        </aside>
      </section>
    </div>
  );
}
