import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { ThemeMode } from "../App";
import { LaunchFlowLayout } from "../components/LaunchFlowLayout";
import { PanelCard } from "../components/PanelCard";
import { resetPassword } from "../lib/api";

export function ResetPasswordPage({
  theme,
  toggleTheme,
}: {
  theme: ThemeMode;
  toggleTheme: () => void;
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const token = searchParams.get("token") ?? "";

  const resetMutation = useMutation({
    mutationFn: async () => resetPassword(token, password),
    onSuccess: () => {
      setStatus("success");
      setStatusMessage("Your password has been reset. Please sign in again with the new password.");
    },
    onError: (error: Error) => {
      setStatus("error");
      setStatusMessage(error.message);
    },
  });

  useEffect(() => {
    if (status === "success") {
      const timeout = window.setTimeout(() => {
        navigate("/", { replace: true });
      }, 1400);
      return () => window.clearTimeout(timeout);
    }
    return undefined;
  }, [navigate, status]);

  const missingToken = token.length === 0;
  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <LaunchFlowLayout
      description="Choose a new password for your account. Reset links are single-use and expire automatically."
      eyebrow="Reset password"
      theme={theme}
      title="Set a fresh password and get back into your account."
      toggleTheme={toggleTheme}
    >
      <PanelCard className="launch-flow-card stack-md">
        <p className="muted-copy">
          Resetting the password signs the account out on all devices, so the new password becomes the only active credential.
        </p>

        <div className="launch-flow-divider" />

        {missingToken ? (
          <div className="stack-md">
            <p className="empty-state" style={{ color: "var(--danger)", borderStyle: "solid" }}>
              This password reset link is missing its token.
            </p>
            <div className="form-actions form-actions--start">
              <Link className="button-primary" to="/forgot-password">
                Request a new reset link
              </Link>
            </div>
          </div>
        ) : (
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              if (passwordMismatch || password.length < 8) {
                return;
              }
              resetMutation.mutate();
            }}
          >
            <label className="field-stack">
              <span className="field-label">New password</span>
              <input
                className="field-input"
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>

            <label className="field-stack">
              <span className="field-label">Confirm new password</span>
              <input
                className="field-input"
                minLength={8}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                type="password"
                value={confirmPassword}
              />
            </label>

            {passwordMismatch ? (
              <p className="empty-state" style={{ color: "var(--danger)", borderStyle: "solid" }}>
                The two passwords do not match.
              </p>
            ) : null}

            {statusMessage ? (
              <p
                className="empty-state"
                style={status === "error" ? { color: "var(--danger)", borderStyle: "solid" } : undefined}
              >
                {statusMessage}
              </p>
            ) : null}

            <div className="form-actions form-actions--start">
              <button className="button-primary" disabled={resetMutation.isPending || passwordMismatch || status === "success"}>
                {resetMutation.isPending ? "Resetting" : "Reset password"}
              </button>
              <Link className="button-secondary button-inline" to="/">
                Back to sign in
              </Link>
            </div>
          </form>
        )}
      </PanelCard>
    </LaunchFlowLayout>
  );
}
