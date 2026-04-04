import type { CSSProperties, ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import type { MeetingSummary } from "../../../../packages/shared/src";
import { formatDateTime } from "../lib/format";
import { createNavigationState } from "../lib/navigation";
import { PanelCard } from "./PanelCard";

interface EventTimelineProps {
  actions?: ReactNode;
  contextLabel: string;
  emptyAction?: ReactNode;
  emptyLabel: string;
  heading: string;
  memberGroupIds?: Set<string>;
  meetings: MeetingSummary[];
  secondaryMeta: "group" | "group-and-location" | "location";
  showGroupLabel?: boolean;
}

function formatTimelineDate(startsAt: string) {
  const date = new Date(startsAt);
  return {
    day: date.toLocaleDateString("en-GB", { day: "2-digit" }),
    month: date.toLocaleDateString("en-GB", { month: "short" }).toUpperCase(),
    weekday: date.toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase(),
    time: date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
  };
}

function pickAccent(seed: string) {
  const palette = ["#8a6d52", "#576f86", "#6f7b5a", "#7c5f66", "#5c7070", "#7b694f"];
  let value = 0;
  for (const character of seed) {
    value = (value * 31 + character.charCodeAt(0)) % palette.length;
  }
  return palette[value] ?? palette[0];
}

export function EventTimeline({
  actions,
  contextLabel,
  emptyAction,
  emptyLabel,
  heading,
  memberGroupIds,
  meetings,
  secondaryMeta,
  showGroupLabel = true,
}: EventTimelineProps) {
  const location = useLocation();

  return (
    <PanelCard className="timeline-panel">
      <div className="timeline-panel__header">
        <div>
          <p className="eyebrow">Timeline</p>
          <h1 className="section-title typewriter-title">{heading}</h1>
        </div>
        {actions}
      </div>

      {meetings.length === 0 ? (
        <div className="stack-sm">
          <p className="empty-state">{emptyLabel}</p>
          {emptyAction}
        </div>
      ) : (
        <div className="timeline-list timeline-list--rail">
          {meetings.map((meeting) => {
            const date = formatTimelineDate(meeting.startsAt);
            const accent = pickAccent(meeting.seriesId ?? meeting.venueId ?? meeting.groupId ?? meeting.id);
            const style = { "--timeline-accent": accent } as CSSProperties;
            const statusLabel = meeting.viewerHasClaimed
              ? "Claimed"
              : memberGroupIds?.has(meeting.groupId)
                ? "Member"
              : meeting.groupVisibility === "public"
                ? "Public"
                : "Group";

            const meta =
              secondaryMeta === "location"
                ? meeting.locationName
                : secondaryMeta === "group"
                  ? meeting.groupName
                  : `${meeting.groupName} · ${meeting.locationName}`;

            return (
              <div className="timeline-item" key={meeting.id} style={style}>
                <div className="timeline-date">
                  <span className="timeline-date__day">{date.day}</span>
                  <span className="timeline-date__month">{date.month}</span>
                  <span className="timeline-date__weekday">{date.weekday}</span>
                  <span className="timeline-date__time">{date.time}</span>
                </div>
                <div className={`timeline-line ${meeting.viewerHasClaimed ? "timeline-line--claimed" : "timeline-line--toned"}`}>
                  <span className={`timeline-dot ${meeting.viewerHasClaimed ? "timeline-dot--claimed" : "timeline-dot--toned"}`} />
                </div>
                <div className="hs-tooltip timeline-entry">
                  <Link
                    className={`hs-tooltip-toggle timeline-card timeline-card--toned ${meeting.viewerHasClaimed ? "timeline-card--claimed" : ""}`}
                    state={createNavigationState(location, contextLabel)}
                    to={`/meetings/${meeting.id}`}
                  >
                    <div className="timeline-card__top">
                      {showGroupLabel ? <p className="timeline-card__group">{meeting.groupName}</p> : <span />}
                      <div className="timeline-card__tags">
                        {meeting.seriesId ? <span className="badge-outline">Series</span> : null}
                        <span className={meeting.viewerHasClaimed ? "badge-accent" : "badge"}>
                          {statusLabel}
                        </span>
                      </div>
                    </div>
                    <h3 className="timeline-card__title">{meeting.title}</h3>
                    <p className="timeline-card__meta">{meta}</p>
                  </Link>
                  <div className="hs-tooltip-content timeline-tooltip hidden" role="tooltip">
                    <p className="timeline-tooltip__title">{meeting.title}</p>
                    <p className="timeline-tooltip__meta">{formatDateTime(meeting.startsAt)}</p>
                    <p className="timeline-tooltip__meta">{meta}</p>
                    <p className="timeline-tooltip__meta">
                      {meeting.claimedSpots}/{meeting.capacity} spots claimed
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PanelCard>
  );
}
