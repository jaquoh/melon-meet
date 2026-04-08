import { useQuery } from "@tanstack/react-query";
import { Clock3, ExternalLink, MapPinned } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";
import type { ViewerSummary } from "../../../../packages/shared/src";
import type { ThemeMode } from "../App";
import { CopyTextButton } from "../components/CopyTextButton";
import { DetailHero } from "../components/DetailHero";
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
            <DetailHero
              description={venue.description}
              eyebrow="Venue"
              imageUrl={venue.heroImageUrl}
              meta={
                <>
                  <span className="mini-chip">{venue.pricing === "free" ? "Free access" : "Paid access"}</span>
                  {venue.openingHoursText ? <span className="mini-chip">{venue.openingHoursText}</span> : null}
                </>
              }
              title={venue.name}
            >
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
            </DetailHero>
            <div className="detail-fact-grid">
              <article className="detail-fact-card">
                <span className="panel-caption">Address</span>
                <strong>{venue.address}</strong>
              </article>
              <article className="detail-fact-card">
                <span className="panel-caption">Access</span>
                <strong>{venue.pricing === "free" ? "Free courts" : "Paid booking"}</strong>
              </article>
              <article className="detail-fact-card">
                <span className="panel-caption">Opening hours</span>
                <strong>{venue.openingHoursText || "Check source before you go"}</strong>
              </article>
            </div>
          </div>
        </div>
      }
      detailCloseTo={closeTarget.fromPath}
      left={
        <div className="stack-panel">
          <div className="detail-card detail-card--compact">
            <span className="panel-caption">Quick links</span>
            <div className="detail-link-list">
              <Link className="mini-link" to="/map">
                Back to map
              </Link>
              <Link className="mini-link" to={`/map?venue=${venue.id}`}>
                Open venue on map
              </Link>
            </div>
          </div>
          {venue.bookingUrl ? (
            <a className="button-secondary" href={venue.bookingUrl} rel="noreferrer" target="_blank">
              <ExternalLink size={14} strokeWidth={2} />
              Booking page
            </a>
          ) : null}
          <a
            className="button-secondary"
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.address)}`}
            rel="noreferrer"
            target="_blank"
          >
            <MapPinned size={14} strokeWidth={2} />
            Open Google Maps
          </a>
          {venue.sourceUrl ? (
            <a className="button-secondary" href={venue.sourceUrl} rel="noreferrer" target="_blank">
              <ExternalLink size={14} strokeWidth={2} />
              Source
            </a>
          ) : null}
          <div className="detail-card detail-card--compact">
            <span className="panel-caption">Practical</span>
            <div className="detail-meta-list">
              <span><Clock3 size={14} strokeWidth={2} />{venue.openingHoursText || "Hours vary"}</span>
              <span><MapPinned size={14} strokeWidth={2} />Berlin venue</span>
            </div>
          </div>
        </div>
      }
      leftHeader={undefined}
      onLogOut={onLogOut}
      right={
        <EventTimeline
          contextLabel={venue.name}
          emptyLabel="No upcoming sessions at this venue."
          heading="Upcoming sessions"
          meetings={meetings}
          secondaryMeta="group"
        />
      }
      rightHeader={undefined}
      theme={theme}
      title={`Venue: ${venue.name}`}
      toggleTheme={toggleTheme}
      viewer={viewer}
    />
  );
}
