import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarDays, Map, Users } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import type { ViewerSummary } from "../../../../packages/shared/src";
import watermelonMark from "../assets/watermelon-mark.svg";
import { logIn, signUp } from "../lib/api";
import { queryClient } from "../lib/query-client";

export function LandingPage({ viewer }: { viewer: ViewerSummary | null }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
        <div className="landing-shell landing-shell--auth">
          <section className="landing-shell__center landing-shell__center--welcome">
            <div className="landing-brand-lockup landing-brand-lockup--stacked">
              <img alt="Melon Meet" className="landing-shell__logo" src={watermelonMark} />
              <div className="landing-brand-lockup__copy">
                <h1 className="landing-brand-lockup__title">Melon Meet</h1>
                <p className="landing-brand-lockup__meta">Berlin Beachvolleyball</p>
              </div>
            </div>

            <div className="stack-sm landing-shell__intro">
              <h2 className="landing-hero__title">Find Beachvolleyball courts, groups, and sessions.</h2>
              <p className="landing-hero__text">
                Explore courts and communities around Berlin, browse public sessions, and find the right place to play.
              </p>
            </div>

            <div className="landing-entry-actions landing-entry-actions--single">
              <Link className="landing-entry-button" to="/map">
                <Map size={18} strokeWidth={2} />
                <span className="landing-entry-button__title">Map</span>
                <span className="landing-entry-button__copy">Courts, venues, sessions, and public groups on one board.</span>
              </Link>
              <Link className="landing-entry-button" to="/groups">
                <Users size={18} strokeWidth={2} />
                <span className="landing-entry-button__title">Groups</span>
                <span className="landing-entry-button__copy">Private groups first when signed in, then all public communities.</span>
              </Link>
              <Link className="landing-entry-button" to="/sessions">
                <CalendarDays size={18} strokeWidth={2} />
                <span className="landing-entry-button__title">Sessions</span>
                <span className="landing-entry-button__copy">See upcoming play in timeline order and jump straight into a session.</span>
              </Link>
            </div>
          </section>

          <section className="landing-shell__right">
            {viewer ? (
              <div className="panel-card stack-sm landing-auth-card">
                <p className="eyebrow">Welcome back</p>
                <p className="landing-hero__text">
                  You are already signed in. Jump back into the board and keep organising sessions, venues, and groups.
                </p>
                <div className="workspace-button-row">
                  <Link className="button-primary" to="/map">
                    Open map
                  </Link>
                  <Link className="button-secondary" to={`/profile/${viewer.id}`}>
                    Open profile
                  </Link>
                </div>
              </div>
            ) : (
              <div className="panel-card stack-md landing-auth-card">
                <div className="stack-sm">
                  <p className="eyebrow">Participation</p>
                  <p className="landing-hero__text typewriter-title">
                    Sign up when you want to contribute, organise, and unlock the full board.
                  </p>
                  <p className="landing-hero__text">
                    Contribute, add venues, create public or private groups, and attend public or private sessions. Public browsing stays open, but signing in turns discovery into participation.
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
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
