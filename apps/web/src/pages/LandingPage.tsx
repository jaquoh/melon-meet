import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, LogIn, Moon, Sun, User, X } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { ViewerSummary } from "../../../../packages/shared/src";
import type { ThemeMode } from "../App";
import landingHeroMelonDark from "../assets/landing-hero-melon-dark.png";
import landingHeroMelon from "../assets/landing-hero-melon.png";
import watermelonMark from "../assets/watermelon-mark.svg";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { logIn, signUp } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { queryClient } from "../lib/query-client";

export function LandingPage({
  theme,
  toggleTheme,
  viewer,
}: {
  theme: ThemeMode;
  toggleTheme: () => void;
  viewer: ViewerSummary | null;
}) {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [showAuthPanel, setShowAuthPanel] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedSignupTerms, setAcceptedSignupTerms] = useState(false);
  const landingBackgroundImage = theme === "dark" ? landingHeroMelonDark : landingHeroMelon;
  const infoLinkState = { infoReturnTo: `${location.pathname}${location.search}` };
  const renderHeaderControls = () => (
    <div className="landing-shell__right-header">
      <div className="landing-shell__right-header-left">
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
      {viewer ? (
        <Link className="landing-header-button landing-header-button--label landing-header-button--edge" to={`/profile/${viewer.id}`}>
          <User size={16} strokeWidth={2} />
          <span>{t("landing.profile")}</span>
        </Link>
      ) : (
        <button
          aria-label={showAuthPanel ? t("landing.closeAuth") : t("common.signIn")}
          className="landing-header-button landing-header-button--label landing-header-button--auth landing-header-button--edge"
          onClick={() => setShowAuthPanel((current) => !current)}
          type="button"
        >
          {showAuthPanel ? <X size={16} strokeWidth={2} /> : <LogIn size={16} strokeWidth={2} />}
          <span className="landing-header-button__label">{showAuthPanel ? t("landing.closeAuth") : t("common.signIn")}</span>
        </button>
      )}
    </div>
  );

  const authMutation = useMutation({
    mutationFn: async () => (mode === "login" ? logIn(email, password) : signUp(email, password)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      navigate("/map");
    },
  });

  return (
    <div className="workspace-page landing-workspace-page">
      <div className="workspace-frame landing-shell-frame">
        <div className="landing-scene" aria-hidden="true">
          <img alt="" className="landing-scene__image" src={landingBackgroundImage} />
        </div>
        <div className={`landing-shell landing-shell--auth ${showAuthPanel ? "landing-shell--auth-open" : ""}`.trim()}>
          <section className="landing-shell__center landing-shell__center--welcome">
            <div className="landing-mobile-header">
              <div className="landing-brand-lockup landing-brand-lockup--stacked">
                <img alt="Melon Meet" className="landing-shell__logo" src={watermelonMark} />
                <div className="landing-brand-lockup__copy">
                  <h1 className="landing-brand-lockup__title">Melon Meet</h1>
                  <p className="landing-brand-lockup__meta">{t("landing.meta")}</p>
                </div>
              </div>
              <div className="landing-mobile-actions">{renderHeaderControls()}</div>
            </div>

            <div className="landing-hero-grid">
              <div className="stack-sm landing-shell__intro">
                <h2 className="landing-hero__title">{t("landing.heroTitle")}</h2>
              </div>
            </div>

            <div className="landing-entry-actions landing-entry-actions--single">
              <Link className="landing-entry-button" to="/map">
                <span className="landing-entry-button__title">{t("landing.discoverBeachTitle")}</span>
                <span className="landing-entry-button__copy">{t("landing.discoverBeachCopy")}</span>
                <span className="landing-entry-button__arrow" aria-hidden="true">
                  <ArrowRight size={34} strokeWidth={2.1} />
                </span>
              </Link>
            </div>
          </section>

          <section className="landing-shell__right">
            {renderHeaderControls()}

            {viewer ? null : showAuthPanel ? (
              <div className="landing-shell__right-body">
                <div className="stack-sm">
                  <p className="eyebrow">{t("landing.participationEyebrow")}</p>
                  <p className="landing-hero__text typewriter-title">{t("landing.participationTitle")}</p>
                  <p className="landing-hero__text">{t("landing.participationText")}</p>
                </div>

                <div className="mode-switch">
                  <button
                    className={`mode-switch__button ${mode === "login" ? "is-active" : ""}`}
                    onClick={() => setMode("login")}
                    type="button"
                  >
                    {t("common.signIn")}
                  </button>
                  <button
                    className={`mode-switch__button ${mode === "signup" ? "is-active" : ""}`}
                    onClick={() => setMode("signup")}
                    type="button"
                  >
                    {t("common.signUp")}
                  </button>
                </div>

                <form
                  className="form-grid"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (mode === "signup" && !acceptedSignupTerms) {
                      return;
                    }
                    authMutation.mutate();
                  }}
                >
                  <label className="field-stack">
                    <span className="field-label">{t("landing.email")}</span>
                    <input className="field-input" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
                  </label>

                  <label className="field-stack">
                    <span className="field-label">{t("landing.password")}</span>
                    <input
                      className="field-input"
                      minLength={8}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      type="password"
                      value={password}
                    />
                  </label>

                  {mode === "signup" ? (
                    <div className="auth-consent-row">
                      <input
                        checked={acceptedSignupTerms}
                        id="signup-legal-consent"
                        onChange={(event) => setAcceptedSignupTerms(event.target.checked)}
                        type="checkbox"
                      />
                      <label htmlFor="signup-legal-consent">
                        {t("landing.consentPrefix")}{" "}
                        <Link state={infoLinkState} to="/privacy">
                          {t("info.pages.privacy.title")}
                        </Link>{" "}
                        {t("landing.consentMiddle")}{" "}
                        <Link state={infoLinkState} to="/terms">
                          {t("info.pages.terms.title")}
                        </Link>
                        .
                      </label>
                    </div>
                  ) : null}

                  {authMutation.error ? (
                    <p className="empty-state" style={{ color: "var(--danger)", borderStyle: "solid" }}>
                      {authMutation.error.message}
                    </p>
                  ) : null}

                  <div className="form-actions form-actions--start">
                    <button className="button-primary" disabled={authMutation.isPending || (mode === "signup" && !acceptedSignupTerms)}>
                      {authMutation.isPending ? t("common.working") : mode === "login" ? t("common.signIn") : t("landing.createAccount")}
                    </button>
                  </div>
                </form>
              </div>
            ) : null}
          </section>
        </div>
        <div className="landing-legal-links landing-legal-links--landing" aria-label={t("workspace.infoAndLegalPages")}>
          {[
            { key: "info", label: t("info.links.info"), to: "/about" },
            { key: "privacy", label: t("info.links.privacy"), to: "/privacy" },
            { key: "terms", label: t("info.links.terms"), to: "/terms" },
            { key: "impressum", label: t("info.links.impressum"), to: "/impressum" },
          ].map((link) => (
            <Link
              key={link.key}
              state={infoLinkState}
              to={link.to}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
