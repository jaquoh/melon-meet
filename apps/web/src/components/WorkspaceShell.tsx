import type { ReactNode } from "react";
import { Moon, Sun, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import type { ViewerSummary } from "../../../../packages/shared/src";
import watermelonMark from "../assets/watermelon-mark.svg";

type ThemeMode = "light" | "dark";

interface WorkspaceShellProps {
  center: ReactNode;
  left: ReactNode;
  leftHeader: ReactNode;
  mobileCollapsePanels?: boolean;
  right: ReactNode;
  rightHeader: ReactNode;
  theme: ThemeMode;
  title?: string;
  toggleTheme: () => void;
  topCenter?: ReactNode;
  viewer: ViewerSummary | null;
  onLogOut?: () => void;
  detailCloseTo?: string;
}

export function WorkspaceShell({
  center,
  detailCloseTo,
  left,
  leftHeader,
  mobileCollapsePanels = false,
  right,
  rightHeader,
  theme,
  toggleTheme,
  viewer,
  onLogOut,
}: WorkspaceShellProps) {
  const navigate = useNavigate();

  const actions = detailCloseTo ? (
    <div className="workspace-auth">
      <button className="workspace-action workspace-action--close" onClick={() => navigate(detailCloseTo)} type="button">
        <X size={16} strokeWidth={2} />
        <span>Close</span>
      </button>
      <button
        aria-label="Toggle theme"
        className="workspace-action workspace-action--icon"
        onClick={toggleTheme}
        type="button"
      >
        {theme === "dark" ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
      </button>
    </div>
  ) : (
    <div className="workspace-auth">
      {viewer ? (
        <details className="workspace-user-menu">
          <summary className="workspace-action workspace-action--primary">
            <span className="workspace-user-pill">
              <span className="workspace-user-pill__avatar">
                {viewer.avatarUrl ? <img alt={viewer.displayName} src={viewer.avatarUrl} /> : viewer.displayName.slice(0, 1)}
              </span>
              <span>{viewer.displayName}</span>
            </span>
          </summary>
          <div className="workspace-user-menu__panel">
            <Link className="workspace-menu-link" to={`/profile/${viewer.id}`}>
              Profile
            </Link>
            {onLogOut ? (
              <button className="workspace-menu-link" onClick={onLogOut} type="button">
                Sign out
              </button>
            ) : null}
          </div>
        </details>
      ) : (
        <Link className="workspace-action workspace-action--primary" to="/auth">
          Sign in
        </Link>
      )}
      <button
        aria-label="Toggle theme"
        className="workspace-action workspace-action--icon"
        onClick={toggleTheme}
        type="button"
      >
        {theme === "dark" ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
      </button>
    </div>
  );

  return (
    <div className={`workspace-page ${mobileCollapsePanels ? "workspace-page--collapse" : ""}`.trim()}>
      <div
        className={`workspace-frame ${mobileCollapsePanels ? "workspace-frame--collapse" : ""} ${detailCloseTo ? "workspace-frame--detail" : ""}`.trim()}
      >
        <div className="workspace-shell">
          <div className="workspace-cell workspace-cell--mobile-top">
            <div className="workspace-mobile-inline">
              <Link className="workspace-mobile-brand" to="/">
                <img alt="Melon Meet" className="workspace-brand__mark" src={watermelonMark} />
                <div className="workspace-brand__copy">
                  <span className="workspace-brand__name">Melon Meet</span>
                  <span className="workspace-brand__meta">Berlin Beachvolleyball</span>
                </div>
              </Link>
              <div className="workspace-mobile-inline__actions">{actions}</div>
            </div>
          </div>

          <Link className="workspace-cell workspace-cell--brand" to="/">
            <img alt="Melon Meet" className="workspace-brand__mark" src={watermelonMark} />
            <div className="workspace-brand__copy">
              <span className="workspace-brand__name">Melon Meet</span>
              <span className="workspace-brand__meta">Berlin Beachvolleyball</span>
            </div>
          </Link>

          <div className="workspace-cell workspace-cell--top workspace-cell--top-right">{actions}</div>

          <section
            className={`workspace-cell workspace-cell--panel ${leftHeader ? "" : "workspace-cell--panel-no-header"} workspace-cell--left`.trim()}
          >
            {leftHeader ? <div className="workspace-panel__header">{leftHeader}</div> : null}
            <div className="workspace-panel__body">{left}</div>
          </section>

          <section className="workspace-cell workspace-cell--center">{center}</section>

          <section
            className={`workspace-cell workspace-cell--panel ${rightHeader ? "" : "workspace-cell--panel-no-header"} workspace-cell--right`.trim()}
          >
            {rightHeader ? <div className="workspace-panel__header">{rightHeader}</div> : null}
            <div className="workspace-panel__body">{right}</div>
          </section>
        </div>
      </div>
    </div>
  );
}
