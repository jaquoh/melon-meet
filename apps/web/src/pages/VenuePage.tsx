import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "react-router-dom";
import type { ViewerSummary } from "../../../../packages/shared/src";
import { EventTimeline } from "../components/EventTimeline";
import { MeetingForm } from "../components/MeetingForm";
import { PanelCard } from "../components/PanelCard";
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

  const backTarget = resolveNavigationState(location.state, "/", "Map board");
  const venueNavigationState = createNavigationState(location, venueQuery.data.venue.name);
  const nextMeeting = venueQuery.data.meetings[0] ?? null;

  return (
    <div className="page-wrap page-wrap--workspace">
      <section className="home-main-shell">
        <aside className="timeline-rail">
          <EventTimeline
            contextLabel={venueQuery.data.venue.name}
            emptyLabel="No active meetings are scheduled for this venue."
            heading="Venue events"
            meetings={venueQuery.data.meetings}
            secondaryMeta="group"
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
                <p className="eyebrow">Venue</p>
                <h1 className="display-title">Venue: {venueQuery.data.venue.name}</h1>
                <p className="muted-copy">{venueQuery.data.venue.description}</p>
              </div>
              <div className="compact-badges">
                <span className="badge-outline">{venueQuery.data.venue.pricing}</span>
                <span className="badge">{venueQuery.data.meetings.length} events</span>
              </div>
            </div>
          </PanelCard>

          <div className="detail-shell">
            <section className="stack-md">
              <PanelCard className="panel-card--highlight stack-md">
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

                <div className="form-actions form-actions--start">
                  {nextMeeting ? (
                    <Link className="button-secondary" state={venueNavigationState} to={`/meetings/${nextMeeting.id}`}>
                      Open next meeting
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
                  {venueQuery.data.venue.sourceUrl ? (
                    <a className="button-secondary" href={venueQuery.data.venue.sourceUrl} rel="noreferrer" target="_blank">
                      Venue source
                    </a>
                  ) : null}
                </div>
              </PanelCard>

              {showCreateForm ? (
                <PanelCard className="stack-md">
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
                </PanelCard>
              ) : null}
            </section>

            <aside className="stack-md">
              <PanelCard className="stack-md">
                <div>
                  <p className="eyebrow">Schedule summary</p>
                  <h2 className="detail-title">Meetings at this venue</h2>
                </div>

                <div className="stack-sm scroll-stack">
                  {venueQuery.data.meetings.length === 0 ? (
                    <p className="empty-state">No active meetings at this venue.</p>
                  ) : (
                    venueQuery.data.meetings.slice(0, 6).map((meeting) => (
                      <Link
                        className="terminal-item terminal-item--link"
                        key={meeting.id}
                        state={venueNavigationState}
                        to={`/meetings/${meeting.id}`}
                      >
                        <div className="terminal-item__row">
                          <div>
                            <p className="terminal-item__title">{meeting.title}</p>
                            <p className="terminal-item__meta">{formatDateTime(meeting.startsAt)}</p>
                          </div>
                          <span className="badge-outline">{meeting.groupName}</span>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </PanelCard>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}
