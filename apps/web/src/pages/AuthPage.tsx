import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import type { ViewerSummary } from "../../../../packages/shared/src";
import watermelonMark from "../assets/watermelon-mark.svg";
import { PanelCard } from "../components/PanelCard";
import { logIn, signUp } from "../lib/api";
import { queryClient } from "../lib/query-client";

export function AuthPage({ viewer }: { viewer: ViewerSummary | null }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const authMutation = useMutation({
    mutationFn: async () => (mode === "login" ? logIn(email, password) : signUp(email, password)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      navigate("/");
    },
  });

  if (viewer) {
    return <Navigate replace to="/" />;
  }

  return (
    <div className="page-wrap auth-splash">
      <section className="auth-splash__layout">
        <div className="auth-splash__hero">
          <img alt="Watermelon illustration" className="auth-splash__melon" src={watermelonMark} />

          <div className="stack-md">
            <div className="stack-sm">
              <p className="eyebrow">Account access</p>
              <h1 className="landing-hero__title">Sign up when you want to contribute, organise, and unlock the full board.</h1>
            </div>

            <p className="landing-hero__text">
              Contribute, add venues, create public or private groups, and attend public or private sessions.
              Public browsing stays open, but signing in turns discovery into participation.
            </p>

            <div className="auth-promo-list">
              <div className="auth-promo-item">
                <span className="auth-promo-item__index">01</span>
                <p>Create and manage your own public or private groups.</p>
              </div>
              <div className="auth-promo-item">
                <span className="auth-promo-item__index">02</span>
                <p>Add sessions, claim spots, and contribute venue information.</p>
              </div>
              <div className="auth-promo-item">
                <span className="auth-promo-item__index">03</span>
                <p>Keep smaller invite-only crews organised without losing the public discovery flow.</p>
              </div>
            </div>

            <div className="auth-demo-box">
              <p className="eyebrow">Demo account</p>
              <p>demo@melonmeet.local</p>
              <p>demo12345</p>
            </div>
          </div>
        </div>

        <PanelCard className="auth-card stack-md">
          <div className="stack-sm">
            <p className="eyebrow">Identity</p>
            <h2 className="section-title">{mode === "login" ? "Log in to your account" : "Create your account"}</h2>
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
              <input className="field-input" minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
            </label>

            {authMutation.error ? (
              <p className="empty-state" style={{ color: "var(--danger)", borderStyle: "solid" }}>
                {authMutation.error.message}
              </p>
            ) : null}

            <p className="muted-copy">
              {mode === "login"
                ? "Use your account to manage groups, claim session spots, and keep your participation in sync."
                : "Create an account to contribute new venues, build groups, and join public or private sessions."}
            </p>

            <div className="form-actions form-actions--start">
              <button className="button-primary" disabled={authMutation.isPending}>
                {authMutation.isPending ? "Working" : mode === "login" ? "Log in" : "Create account"}
              </button>
            </div>
          </form>
        </PanelCard>
      </section>
    </div>
  );
}
