import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import type { ViewerSummary } from "../../../../packages/shared/src";
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
    <div className="page-wrap">
      <div className="section-grid section-grid--split" style={{ alignItems: "center", minHeight: "calc(100vh - 9rem)" }}>
        <PanelCard className="panel-card--highlight stack-md">
          <div className="hero-grid">
            <div className="stack-sm">
              <p className="eyebrow">Access node</p>
              <h1 className="display-title">
                Claim spots.
                <br />
                Manage crews.
                <br />
                <span className="script-copy">keep the board in sync.</span>
              </h1>
            </div>
            <div className="note-box">
              Demo login:
              <br />
              demo@melonmeet.local
              <br />
              demo12345
            </div>
          </div>

          <p className="muted-copy">
            Public map browsing stays open, but account access unlocks private groups, recurring sessions,
            claims, and role-aware editing.
          </p>

          <div className="info-grid">
            <div className="metric-box">
              <p className="metric-box__value">01</p>
              <p className="metric-box__label">Map-first meetup creation</p>
            </div>
            <div className="metric-box">
              <p className="metric-box__value">02</p>
              <p className="metric-box__label">Public and private crew control</p>
            </div>
          </div>
        </PanelCard>

        <PanelCard className="stack-md">
          <div>
            <p className="eyebrow">Identity</p>
            <h2 className="section-title">Enter the system</h2>
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

            <div className="form-actions" style={{ justifyContent: "space-between" }}>
              <p className="muted-copy" style={{ fontSize: "0.78rem", maxWidth: "20rem" }}>
                {mode === "login" ? "Use an existing account to join and manage sessions." : "Create a new player account to unlock posting and meeting creation."}
              </p>
              <button className="button-primary" disabled={authMutation.isPending}>
                {authMutation.isPending ? "Working" : mode === "login" ? "Log in" : "Create account"}
              </button>
            </div>
          </form>
        </PanelCard>
      </div>
    </div>
  );
}
