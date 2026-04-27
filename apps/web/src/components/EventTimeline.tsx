import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import type { MeetingSummary } from "../../../../packages/shared/src";
import { useI18n } from "../lib/i18n";
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
  selectedMeetingId?: string | null;
}

function formatTimelineDate(startsAt: string, locale: string) {
  const date = new Date(startsAt);
  const now = new Date();
  return {
    day: date.toLocaleDateString(locale, { day: "2-digit" }),
    isToday:
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate(),
    month: date.toLocaleDateString(locale, { month: "short" }).toUpperCase(),
    weekday: date.toLocaleDateString(locale, { weekday: "short" }).toUpperCase(),
    time: date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }),
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
  meetings,
  onSelectMeeting,
  secondaryMeta = "group-and-location",
  selectedMeetingId = null,
}: EventTimelineProps) {
  const { formatPrice, locale, t } = useI18n();
  const location = useLocation();
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [isHeaderStuck, setIsHeaderStuck] = useState(false);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) {
      setIsHeaderStuck(false);
      return;
    }

    const scrollContainer =
      header.closest<HTMLElement>(".workspace-panel__body") ??
      header.closest<HTMLElement>(".mobile-details-drawer__body") ??
      header.closest<HTMLElement>(".workspace-detail-scroll");

    if (!scrollContainer) {
      setIsHeaderStuck(false);
      return;
    }

    const updateStickyState = () => {
      const headerTop = header.getBoundingClientRect().top;
      const containerTop = scrollContainer.getBoundingClientRect().top;
      setIsHeaderStuck(headerTop <= containerTop + 1);
    };

    updateStickyState();
    scrollContainer.addEventListener("scroll", updateStickyState, { passive: true });
    window.addEventListener("resize", updateStickyState);
    return () => {
      scrollContainer.removeEventListener("scroll", updateStickyState);
      window.removeEventListener("resize", updateStickyState);
    };
  }, [heading, meetings.length]);

  const headerClassName = `timeline-panel__header ${isHeaderStuck ? "is-stuck" : ""}`.trim();

  if (meetings.length === 0) {
    return (
      <div className="timeline-panel timeline-panel--embedded">
        {heading ? (
          <div className={headerClassName} ref={headerRef}>
            <div>
              <p className="eyebrow">{t("common.timeline")}</p>
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
        <div className={headerClassName} ref={headerRef}>
          <div>
            {heading ? <p className="eyebrow">{t("common.timeline")}</p> : null}
            {heading ? <h2 className="section-title typewriter-title">{heading}</h2> : null}
          </div>
          {actions}
        </div>
      ) : null}

      <div className="timeline-list timeline-list--rail">
        {meetings.map((meeting) => {
          const date = formatTimelineDate(meeting.startsAt, locale);
          const isSelected = selectedMeetingId === meeting.id;
          const accent = pickAccent(meeting.seriesId ?? meeting.venueId ?? meeting.groupId ?? meeting.id);
          const style = { "--timeline-accent": accent } as CSSProperties;
          const metaLines =
            secondaryMeta === "location"
              ? [`@${meeting.locationName}`]
              : secondaryMeta === "group"
                ? [t("timeline.from", { value: meeting.groupName })]
                : [t("timeline.from", { value: meeting.groupName }), t("timeline.location", { value: meeting.locationName })];

          const card = (
            <>
              <div className="timeline-card__top">
                <div className="timeline-card__copy">
                  <h3 className={`timeline-card__title ${meeting.status === "cancelled" ? "session-title--cancelled" : ""}`.trim()}>
                    {meeting.shortName || meeting.title}
                  </h3>
                  <div className="timeline-card__meta-stack">
                    {metaLines.map((line) => (
                      <p className="timeline-card__meta" key={line}>{line}</p>
                    ))}
                  </div>
                </div>
                <div className="timeline-card__side-stack">
                  {meeting.status === "cancelled" ? <span className="badge-cancelled">{t("common.cancelled")}</span> : null}
                  <span className="badge">{formatPrice(meeting.pricing, meeting.costPerPerson)}</span>
                  <span className="badge-outline">{`${meeting.claimedSpots}/${meeting.capacity}`}</span>
                </div>
              </div>
              <div className="timeline-card__meta-row">
                <div className="timeline-card__tags timeline-card__tags--bottom-right">
                  {meeting.seriesId && !meeting.viewerHasClaimed ? <span className="badge-outline">{t("timeline.series")}</span> : null}
                  {meeting.viewerHasClaimed ? <span className="badge-accent">{t("common.claimed")}</span> : null}
                </div>
              </div>
              {date.isToday ? (
                <div className="timeline-card__notice-row">
                  <span className="badge-accent">{t("common.today")}</span>
                </div>
              ) : null}
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
                  className={`timeline-card timeline-card--toned ${meeting.viewerHasClaimed ? "timeline-card--claimed" : ""} ${
                    isSelected ? "is-selected" : ""
                  }`.trim()}
                  data-active-list-item={isSelected ? "true" : undefined}
                  onClick={() => onSelectMeeting(meeting)}
                  type="button"
                >
                  {card}
                </button>
              ) : (
                <Link
                  className={`timeline-card timeline-card--toned ${meeting.viewerHasClaimed ? "timeline-card--claimed" : ""} ${
                    isSelected ? "is-selected" : ""
                  }`.trim()}
                  data-active-list-item={isSelected ? "true" : undefined}
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
