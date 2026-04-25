import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarDays, LogIn, Map, Moon, Sun, User, Users, X } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { ViewerSummary } from "../../../../packages/shared/src";
import type { ThemeMode } from "../App";
import landingHeroMelonDark from "../assets/landing-hero-melon-dark.png";
import landingHeroMelon from "../assets/landing-hero-melon.png";
import watermelonMark from "../assets/watermelon-mark.svg";
import { logIn, signUp } from "../lib/api";
import { queryClient } from "../lib/query-client";
import { INFO_LINKS } from "./InfoPage";

export function LandingPage({
  theme,
  toggleTheme,
  viewer,
}: {
  theme: ThemeMode;
  toggleTheme: () => void;
  viewer: ViewerSummary | null;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [showAuthPanel, setShowAuthPanel] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const landingBackgroundImage = theme === "dark" ? landingHeroMelonDark : landingHeroMelon;
  const infoLinkState = { infoReturnTo: `${location.pathname}${location.search}` };
  const renderHeaderControls = () => (
    <div className="landing-shell__right-header">
      <button
        aria-label="Toggle theme"
        className="landing-theme-toggle"
        onClick={toggleTheme}
        type="button"
      >
        {theme === "dark" ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
      </button>
      {viewer ? (
        <Link className="landing-header-button landing-header-button--label" to={`/profile/${viewer.id}`}>
          <User size={16} strokeWidth={2} />
          <span>Profile</span>
        </Link>
      ) : (
        <button
          className="landing-header-button landing-header-button--label landing-header-button--auth"
          onClick={() => setShowAuthPanel((current) => !current)}
          type="button"
        >
          {showAuthPanel ? <X size={16} strokeWidth={2} /> : <LogIn size={16} strokeWidth={2} />}
          <span>{showAuthPanel ? "Close" : "Sign in"}</span>
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
                  <p className="landing-brand-lockup__meta">Berlin Beachvolleyball</p>
                </div>
              </div>
              <div className="landing-mobile-actions">{renderHeaderControls()}</div>
            </div>

            <div className="landing-hero-grid">
              <div className="stack-sm landing-shell__intro">
                <h2 className="landing-hero__title">Meet your sporty Mellows!</h2>
                <p className="landing-hero__text">
                  Find the court, catch the vibe, and jump into Berlin beach volleyball with people who are ready to play.
                </p>
              </div>
            </div>

            <div className="landing-entry-actions landing-entry-actions--single">
              <Link className="landing-entry-button" to="/map">
                <Map size={18} strokeWidth={2} />
                <span className="landing-entry-button__title">Find your beach</span>
                <span className="landing-entry-button__copy">Open the live melon map for courts, venues, nearby play, and public crews.</span>
              </Link>
              <Link className="landing-entry-button" to="/groups">
                <Users size={18} strokeWidth={2} />
                <span className="landing-entry-button__title">Join the Mellows</span>
                <span className="landing-entry-button__copy">Browse friendly crews, private circles, and public communities looking for players.</span>
              </Link>
              <Link className="landing-entry-button" to="/sessions">
                <CalendarDays size={18} strokeWidth={2} />
                <span className="landing-entry-button__title">Catch a session</span>
                <span className="landing-entry-button__copy">See upcoming sessions by time and claim a sandy spot when you are ready.</span>
              </Link>
            </div>
          </section>

          <section className="landing-shell__right">
            {renderHeaderControls()}

            {viewer ? null : showAuthPanel ? (
              <div className="landing-shell__right-body">
                <div className="stack-sm">
                  <p className="eyebrow">Participation</p>
                  <p className="landing-hero__text typewriter-title">
                    Sign up when you want to contribute, organise, and unlock the full board.
                  </p>
                  <p className="landing-hero__text">
                    Contribute, create public or private groups and attend sessions. Public browsing stays open, but signing in turns discovery into participation.
                  </p>
                </div>

                <div className="mode-switch">
                  <button
                    className={`mode-switch__button ${mode === "login" ? "is-active" : ""}`}
                    onClick={() => setMode("login")}
                    type="button"
                  >
                    Log in
                  </button>
                  <button
                    className={`mode-switch__button ${mode === "signup" ? "is-active" : ""}`}
                    onClick={() => setMode("signup")}
                    type="button"
                  >
                    Sign up
                  </button>
                </div>

                <form
                  className="form-grid"
                  onSubmit={(event) => {
                    event.preventDefault();
                    authMutation.mutate();
                  }}
                >
                  <label className="field-stack">
                    <span className="field-label">Email</span>
                    <input className="field-input" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
                  </label>

                  <label className="field-stack">
                    <span className="field-label">Password</span>
                    <input
                      className="field-input"
                      minLength={8}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      type="password"
                      value={password}
                    />
                  </label>

                  {authMutation.error ? (
                    <p className="empty-state" style={{ color: "var(--danger)", borderStyle: "solid" }}>
                      {authMutation.error.message}
                    </p>
                  ) : null}

                  <div className="form-actions form-actions--start">
                    <button className="button-primary" disabled={authMutation.isPending}>
                      {authMutation.isPending ? "Working" : mode === "login" ? "Log in" : "Create account"}
                    </button>
                  </div>
                </form>
              </div>
            ) : null}
          </section>
        </div>
        <div className="landing-legal-links landing-legal-links--landing" aria-label="Legal pages">
          {INFO_LINKS.map((link) => (
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
