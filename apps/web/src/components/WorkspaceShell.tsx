import type { MouseEvent, ReactNode } from "react";
import { Map, Moon, Sun, X } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { ViewerSummary } from "../../../../packages/shared/src";
import watermelonMark from "../assets/watermelon-mark.svg";

type ThemeMode = "light" | "dark";

const INFO_FOOTER_LINKS = [
  { label: "About", to: "/about" },
  { label: "Privacy", to: "/privacy" },
  { label: "Terms", to: "/terms" },
  { label: "Impressum", to: "/impressum" },
] as const;

interface WorkspaceShellProps {
  center: ReactNode;
  centerHeader?: ReactNode;
  left: ReactNode;
  leftHeader: ReactNode;
  layoutVariant?: "default" | "info" | "info-detail" | "info-index";
  mobileCollapsePanels?: boolean;
  overlay?: ReactNode;
  profileLinkState?: unknown;
  right: ReactNode;
  rightHeader: ReactNode;
  theme: ThemeMode;
  title?: string;
  toggleTheme: () => void;
  topCenter?: ReactNode;
  viewer: ViewerSummary | null;
  onLogOut?: () => void;
  detailCloseTo?: string;
  utilityNavigation?: "info" | "map";
}

export function WorkspaceShell({
  center,
  centerHeader,
  detailCloseTo,
  layoutVariant = "default",
  left,
  leftHeader,
  mobileCollapsePanels = false,
  profileLinkState,
  right,
  rightHeader,
  theme,
  toggleTheme,
  viewer,
  onLogOut,
  overlay,
  topCenter,
  utilityNavigation = "info",
}: WorkspaceShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const infoReturnTo = `${location.pathname}${location.search}`;
  const showInfoFooter = layoutVariant !== "info" && layoutVariant !== "info-index" && layoutVariant !== "info-detail" && !detailCloseTo;

  function handleDetailClose() {
    if (typeof window !== "undefined" && window.history.state && typeof window.history.state.idx === "number" && window.history.state.idx > 0) {
      navigate(-1);
      return;
    }
    if (detailCloseTo) {
      navigate(detailCloseTo);
    }
  }

  function handleHomeNavigation(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    event.stopPropagation();
    navigate("/", { state: null });
  }

  const utilityActions = (
    <div className="workspace-action-icons">
      <button
        aria-label="Toggle theme"
        className="workspace-action workspace-action--icon"
        onClick={toggleTheme}
        type="button"
      >
        {theme === "dark" ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
      </button>
      {utilityNavigation === "map" ? (
        <Link
          aria-label="Back to map"
          className="workspace-action workspace-action--icon"
          to="/map"
        >
          <Map size={16} strokeWidth={2} />
        </Link>
      ) : null}
    </div>
  );

  const primaryAction = detailCloseTo ? (
    <button className="workspace-action workspace-action--close workspace-action--primary-slot" onClick={handleDetailClose} type="button">
      <X size={16} strokeWidth={2} />
      <span>Close</span>
    </button>
  ) : viewer ? (
    <Link className="workspace-action workspace-action--primary workspace-action--primary-slot" state={profileLinkState} to={`/profile/${viewer.id}`}>
      <span className="workspace-user-pill">
        <span className="workspace-user-pill__avatar">
          {viewer.avatarUrl ? <img alt={viewer.displayName} src={viewer.avatarUrl} /> : viewer.displayName.slice(0, 1)}
        </span>
        <span>{viewer.displayName}</span>
      </span>
    </Link>
  ) : (
    <Link className="workspace-action workspace-action--primary workspace-action--primary-slot" to="/">
      Sign in
    </Link>
  );

  const actions = (
    <div className={`workspace-auth ${utilityNavigation === "map" ? "workspace-auth--with-secondary" : ""}`.trim()}>
      {utilityActions}
      {primaryAction}
    </div>
  );

  return (
    <div className={`workspace-page ${mobileCollapsePanels ? "workspace-page--collapse" : ""}`.trim()}>
      <div
        className={`workspace-frame ${topCenter ? "workspace-frame--unified" : ""} ${mobileCollapsePanels ? "workspace-frame--collapse" : ""} ${detailCloseTo ? "workspace-frame--detail" : ""} ${layoutVariant === "info" || layoutVariant === "info-index" || layoutVariant === "info-detail" ? "workspace-frame--info" : ""} ${layoutVariant === "info-index" ? "workspace-frame--info-index" : ""} ${layoutVariant === "info-detail" ? "workspace-frame--info-detail" : ""}`.trim()}
      >
        <div className="workspace-shell">
          <div className="workspace-cell workspace-cell--mobile-top">
            <div className="workspace-mobile-inline">
              <Link className="workspace-mobile-brand" onClick={handleHomeNavigation} to="/">
                <img alt="Melon Meet" className="workspace-brand__mark" src={watermelonMark} />
                <div className="workspace-brand__copy">
                  <span className="workspace-brand__name">Melon Meet</span>
                  <span className="workspace-brand__meta">Berlin Beachvolleyball</span>
                </div>
              </Link>
              <div className="workspace-mobile-inline__actions">{actions}</div>
            </div>
          </div>

          <Link className="workspace-cell workspace-cell--brand" onClick={handleHomeNavigation} to="/">
            <img alt="Melon Meet" className="workspace-brand__mark" src={watermelonMark} />
            <div className="workspace-brand__copy">
              <span className="workspace-brand__name">Melon Meet</span>
              <span className="workspace-brand__meta">Berlin Beachvolleyball</span>
            </div>
          </Link>

          {topCenter ? <div className="workspace-cell workspace-cell--top workspace-cell--top-center">{topCenter}</div> : null}
          {centerHeader ? <div className="workspace-cell workspace-cell--top workspace-cell--center-header">{centerHeader}</div> : null}

          <div className="workspace-cell workspace-cell--top workspace-cell--top-right">{actions}</div>

          {detailCloseTo || topCenter || layoutVariant === "info" || layoutVariant === "info-index" || layoutVariant === "info-detail" ? null : (
            <section
              className={`workspace-cell workspace-cell--panel ${leftHeader ? "" : "workspace-cell--panel-no-header"} workspace-cell--left`.trim()}
            >
              {leftHeader ? <div className="workspace-panel__header">{leftHeader}</div> : null}
              <div className="workspace-panel__body">{left}</div>
            </section>
          )}

          <section className={`workspace-cell workspace-cell--center ${detailCloseTo ? "workspace-cell--center-detail" : ""}`.trim()}>
            {detailCloseTo ? (
              <div className="workspace-detail-main-column">
                <div className="workspace-detail-main-column__primary">{center}</div>
              </div>
            ) : (
              center
            )}
          </section>

          <section
            className={`workspace-cell workspace-cell--panel ${rightHeader ? "" : "workspace-cell--panel-no-header"} workspace-cell--right`.trim()}
          >
            {rightHeader ? <div className="workspace-panel__header">{rightHeader}</div> : null}
            <div className="workspace-panel__body">
              {detailCloseTo ? (
                <div className="workspace-detail-side-column">
                  {left ? (
                    <div className="workspace-detail-side-column__top">
                      {leftHeader ? <div className="workspace-inline-subheader">{leftHeader}</div> : null}
                      {left}
                    </div>
                  ) : null}
                  {right ? (
                    <div className={`workspace-detail-side-column__bottom ${left ? "workspace-detail-side-column__bottom--with-divider" : ""}`.trim()}>
                      {right}
                    </div>
                  ) : null}
                </div>
              ) : (
                right
              )}
            </div>
          </section>

          {showInfoFooter ? (
            <nav className="workspace-cell workspace-legal-cell" aria-label="Info and legal pages">
              {INFO_FOOTER_LINKS.map((link) => (
                <Link key={link.to} state={{ infoReturnTo }} to={link.to}>
                  {link.label}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
        {overlay ? <div className="workspace-frame-overlay">{overlay}</div> : null}
      </div>
    </div>
  );
}
