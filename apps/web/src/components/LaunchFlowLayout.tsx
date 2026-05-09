import type { ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import watermelonMark from "../assets/watermelon-mark.svg";
import { useI18n } from "../lib/i18n";
import { LanguageSwitcher } from "./LanguageSwitcher";

type ThemeMode = "light" | "dark";

export function LaunchFlowLayout({
  children,
  description,
  eyebrow,
  title,
  theme,
  toggleTheme,
}: {
  children: ReactNode;
  description?: string;
  eyebrow: string;
  title: string;
  theme: ThemeMode;
  toggleTheme: () => void;
}) {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const infoLinkState = { infoReturnTo: `${location.pathname}${location.search}` };

  return (
    <div className="workspace-page landing-workspace-page launch-flow-page">
      <div className="workspace-frame landing-shell-frame launch-flow-frame">
        <div className="launch-flow-scene" aria-hidden="true" />

        <div className="launch-flow-shell">
          <header className="launch-flow-header">
            <Link
              className="launch-flow-brand"
              onClick={(event) => {
                event.preventDefault();
                navigate("/", { state: null });
              }}
              to="/"
            >
              <img alt="Melon Meet" className="launch-flow-brand__mark" src={watermelonMark} />
              <div className="launch-flow-brand__copy">
                <span className="launch-flow-brand__name">Melon Meet</span>
                <span className="launch-flow-brand__meta">{t("workspace.berlinBeachVolleyball")}</span>
              </div>
            </Link>

            <div className="launch-flow-header__actions">
              <LanguageSwitcher compact />
              <button
                aria-label={t("workspace.toggleTheme")}
                className="landing-theme-toggle"
                onClick={toggleTheme}
                type="button"
              >
                {theme === "dark" ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
              </button>
            </div>
          </header>

          <main className="launch-flow-main">
            <div className="launch-flow-main__inner">
              <div className="launch-flow-intro">
                <p className="eyebrow">{eyebrow}</p>
                <h1 className="launch-flow-title">{title}</h1>
                {description ? <p className="launch-flow-description">{description}</p> : null}
              </div>

              <div className="launch-flow-card-wrap">{children}</div>
            </div>
          </main>
        </div>

        <div className="landing-legal-links landing-legal-links--landing launch-flow-legal" aria-label={t("workspace.infoAndLegalPages")}>
          {[
            { key: "info", label: t("info.links.info"), to: "/about" },
            { key: "privacy", label: t("info.links.privacy"), to: "/privacy" },
            { key: "terms", label: t("info.links.terms"), to: "/terms" },
            { key: "impressum", label: t("info.links.impressum"), to: "/impressum" },
          ].map((link) => (
            <Link key={link.key} state={infoLinkState} to={link.to}>
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
