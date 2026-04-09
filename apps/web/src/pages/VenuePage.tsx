import { useQuery } from "@tanstack/react-query";
import { Image as ImageIcon, MapPinned } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";
import type { ViewerSummary } from "../../../../packages/shared/src";
import type { ThemeMode } from "../App";
import { CopyTextButton } from "../components/CopyTextButton";
import { EventTimeline } from "../components/EventTimeline";
import { WorkspaceShell } from "../components/WorkspaceShell";
import { getVenue } from "../lib/api";
import { resolveNavigationState } from "../lib/navigation";

export function VenuePage({
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
  const { venueId = "" } = useParams();
  const location = useLocation();
  const venueQuery = useQuery({
    queryFn: () => getVenue(venueId),
    queryKey: ["venue", venueId],
  });

  if (venueQuery.isLoading) {
    return <div className="loading-shell">Loading venue...</div>;
  }

  if (venueQuery.isError || !venueQuery.data) {
    return <div className="error-shell">{venueQuery.error?.message ?? "Venue not found."}</div>;
  }

  const { venue, meetings } = venueQuery.data;
  const closeTarget = resolveNavigationState(location.state, "/map", "Map");

  return (
    <WorkspaceShell
      center={
        <div className="workspace-detail-scroll">
          <div className="stack-panel">
            <section className="session-detail-main">
              <p className="eyebrow">Venue</p>
              <h1 className="display-title typewriter-title session-detail-main__title">{venue.name}</h1>
                <div className="session-detail-main__hero-row">
                  <div className={`detail-hero__media ${venue.heroImageUrl ? "has-image" : ""}`.trim()}>
                    {venue.heroImageUrl ? <img alt={venue.name} className="detail-hero__image" src={venue.heroImageUrl} /> : null}
                    <div className="detail-hero__fallback" aria-hidden={Boolean(venue.heroImageUrl)}>
                      <ImageIcon size={24} strokeWidth={1.8} />
                    </div>
                  </div>
                  <div className="session-detail-main__summary">
                    <p className="detail-hero__description">{venue.description || "No description yet."}</p>
                  </div>
                </div>
              </section>
            <div className="detail-fact-grid detail-fact-grid--session">
              <article className="detail-fact-card">
                <span className="panel-caption">Access</span>
                <strong className="detail-fact-card__value--mono">{venue.pricing === "free" ? "Free courts" : "Paid booking"}</strong>
              </article>
              <article className="detail-fact-card">
                <span className="panel-caption">Opening hours</span>
                <strong className="detail-fact-card__value--mono">{venue.openingHoursText || "Check source before you go"}</strong>
              </article>
                <article className="detail-fact-card">
                  <span className="panel-caption">Location</span>
                  <strong className="detail-fact-card__value--mono">{venue.address}</strong>
                  <div className="detail-hero__actions">
                  <CopyTextButton label="Copy address" value={venue.address} />
                  <a
                    className="button-secondary button-inline"
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.address)}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <MapPinned size={14} strokeWidth={2} />
                    <span>Open maps</span>
                    </a>
                  </div>
                </article>
              </div>
            </div>
          </div>
      }
      detailCloseTo={closeTarget.fromPath}
      left={
        <div className="stack-panel">
          {(venue.bookingUrl || venue.sourceUrl) ? (
            <section className="detail-section">
              <span className="panel-caption">Links</span>
              <div className="detail-link-list">
                {venue.bookingUrl ? (
                  <a className="mini-link" href={venue.bookingUrl} rel="noreferrer" target="_blank">
                    Booking page
                  </a>
                ) : null}
                {venue.sourceUrl ? (
                  <a className="mini-link" href={venue.sourceUrl} rel="noreferrer" target="_blank">
                    Website
                  </a>
                ) : null}
              </div>
            </section>
          ) : null}
          {(venue.bookingUrl || venue.sourceUrl) ? <div className="list-divider" /> : null}
          <section className="detail-section">
            <span className="panel-caption">Map</span>
            <div className="detail-link-list">
              <Link className="mini-link" to={`/map?venue=${venue.id}`}>
                Open venue on map
              </Link>
            </div>
          </section>
        </div>
      }
      leftHeader={undefined}
      onLogOut={onLogOut}
      right={
        <div className="stack-panel">
          <EventTimeline
            contextLabel={venue.name}
            emptyLabel="No upcoming sessions at this venue."
            heading="Upcoming sessions"
            meetings={meetings}
            secondaryMeta="group"
          />
        </div>
      }
      rightHeader={undefined}
      theme={theme}
      title={`Venue: ${venue.name}`}
      toggleTheme={toggleTheme}
      viewer={viewer}
    />
  );
}
