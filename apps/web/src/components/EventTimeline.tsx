import type { CSSProperties, ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import type { MeetingSummary } from "../../../../packages/shared/src";
import { createNavigationState } from "../lib/navigation";

interface EventTimelineProps {
  actions?: ReactNode;
  contextLabel: string;
  emptyAction?: ReactNode;
  emptyLabel: string;
  heading?: string;
  meetings: MeetingSummary[];
  onSelectMeeting?: (meeting: MeetingSummary) => void;
  secondaryMeta?: "group" | "group-and-location" | "location";
  showGroupLabel?: boolean;
}

function formatTimelineDate(startsAt: string) {
  const date = new Date(startsAt);
  const now = new Date();
  return {
    day: date.toLocaleDateString("en-GB", { day: "2-digit" }),
    isToday:
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate(),
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

function formatSessionPrice(meeting: MeetingSummary) {
  if (meeting.pricing === "free") {
    return "Free";
  }
  if (typeof meeting.costPerPerson === "number") {
    return `${meeting.costPerPerson}€`;
  }
  return "Paid";
}

export function EventTimeline({
  actions,
  contextLabel,
  emptyAction,
  emptyLabel,
  heading,
  meetings,
  onSelectMeeting,
  secondaryMeta = "group-and-location",
  showGroupLabel = true,
}: EventTimelineProps) {
  const location = useLocation();

  if (meetings.length === 0) {
    return (
      <div className="timeline-panel timeline-panel--embedded">
        {heading ? (
          <div className="timeline-panel__header">
            <div>
              <p className="eyebrow">Timeline</p>
              <h2 className="section-title typewriter-title">{heading}</h2>
            </div>
            {actions}
          </div>
        ) : null}
        <div className="stack-sm">
          <p className="empty-state">{emptyLabel}</p>
          {emptyAction}
        </div>
      </div>
    );
  }

  return (
    <div className="timeline-panel timeline-panel--embedded">
      {heading || actions ? (
        <div className="timeline-panel__header">
          <div>
            {heading ? <p className="eyebrow">Timeline</p> : null}
            {heading ? <h2 className="section-title typewriter-title">{heading}</h2> : null}
          </div>
          {actions}
        </div>
      ) : null}

      <div className="timeline-list timeline-list--rail">
        {meetings.map((meeting) => {
          const date = formatTimelineDate(meeting.startsAt);
          const accent = pickAccent(meeting.seriesId ?? meeting.venueId ?? meeting.groupId ?? meeting.id);
          const style = { "--timeline-accent": accent } as CSSProperties;
          const meta =
            secondaryMeta === "location"
              ? meeting.locationName
              : secondaryMeta === "group"
                ? meeting.groupName
                : showGroupLabel
                  ? meeting.locationName
                  : `${meeting.groupName} · ${meeting.locationName}`;

          const card = (
            <>
              <div className="timeline-card__top">
                {showGroupLabel ? <p className="timeline-card__group">{meeting.groupName}</p> : <span />}
                <div className="timeline-card__side-stack">
                  {meeting.status === "cancelled" ? <span className="badge-cancelled">Cancelled</span> : null}
                  <span className="badge">{formatSessionPrice(meeting)}</span>
                  <span className="badge-outline">{`${meeting.claimedSpots}/${meeting.capacity}`}</span>
                </div>
              </div>
              <h3 className={`timeline-card__title ${meeting.status === "cancelled" ? "session-title--cancelled" : ""}`.trim()}>
                {meeting.shortName || meeting.title}
              </h3>
              <div className="timeline-card__meta-row">
                <p className="timeline-card__meta">{meta}</p>
                <div className="timeline-card__tags timeline-card__tags--bottom-right">
                  {date.isToday ? <span className="badge-accent">Today</span> : null}
                  {meeting.seriesId && !meeting.viewerHasClaimed ? <span className="badge-outline">Series</span> : null}
                  {meeting.viewerHasClaimed ? <span className="badge-accent">Claimed</span> : null}
                </div>
              </div>
            </>
          );

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
              {onSelectMeeting ? (
                <button
                  className={`timeline-card timeline-card--toned ${meeting.viewerHasClaimed ? "timeline-card--claimed" : ""}`}
                  onClick={() => onSelectMeeting(meeting)}
                  type="button"
                >
                  {card}
                </button>
              ) : (
                <Link
                  className={`timeline-card timeline-card--toned ${meeting.viewerHasClaimed ? "timeline-card--claimed" : ""}`}
                  state={createNavigationState(location, contextLabel)}
                  to={`/sessions/${meeting.id}`}
                >
                  {card}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
