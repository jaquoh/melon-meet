import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { ThemeMode } from "../App";
import { FormInput } from "../components/FormInput";
import { LaunchFlowLayout } from "../components/LaunchFlowLayout";
import { PanelCard } from "../components/PanelCard";
import { requestPasswordReset } from "../lib/api";

export function ForgotPasswordPage({
  theme,
  toggleTheme,
}: {
  theme: ThemeMode;
  toggleTheme: () => void;
}) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submittedMessage, setSubmittedMessage] = useState("");
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  const forgotPasswordMutation = useMutation({
    mutationFn: requestPasswordReset,
    onSuccess: (response) => {
      setSubmitted(true);
      setSubmittedMessage(response.message);
      setDevResetUrl(response.devResetUrl ?? null);
    },
    onError: (error: Error) => {
      setSubmitted(false);
      setSubmittedMessage(error.message);
      setDevResetUrl(null);
    },
  });

  return (
    <LaunchFlowLayout
      description="Enter your account email and we will prepare a password reset link if the account exists."
      eyebrow="Password recovery"
      theme={theme}
      title="Reset your password without waiting on support."
      toggleTheme={toggleTheme}
    >
      <PanelCard className="launch-flow-card stack-md">
        <p className="muted-copy">
          For security, this flow always shows the same result whether or not the email exists.
        </p>

        <div className="launch-flow-divider" />

        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            forgotPasswordMutation.mutate(email);
          }}
        >
          <label className="field-stack">
            <span className="field-label">Email</span>
            <FormInput autoComplete="email" onChange={setEmail} required type="email" value={email} />
          </label>

          {submittedMessage ? (
            <p
              className="empty-state"
              style={submitted ? undefined : { color: "var(--danger)", borderStyle: "solid" }}
            >
              {submittedMessage}
            </p>
          ) : null}

          <div className="form-actions form-actions--start">
            <button className="button-primary" disabled={forgotPasswordMutation.isPending}>
              {forgotPasswordMutation.isPending ? "Sending" : "Send reset link"}
            </button>
            <Link className="button-secondary button-inline" to="/">
              Back to sign in
            </Link>
          </div>
        </form>

        {devResetUrl ? (
          <>
            <div className="launch-flow-divider" />
            <div className="stack-sm">
              <p className="eyebrow">Local development</p>
              <a className="muted-copy" href={devResetUrl}>
                Open reset-password link
              </a>
            </div>
          </>
        ) : null}
      </PanelCard>
    </LaunchFlowLayout>
  );
}
