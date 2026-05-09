import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import type { ViewerSummary } from "../../../../packages/shared/src";
import type { ThemeMode } from "../App";
import { LaunchFlowLayout } from "../components/LaunchFlowLayout";
import { PanelCard } from "../components/PanelCard";
import { resendVerificationEmail, verifyEmailToken } from "../lib/api";
import { queryClient } from "../lib/query-client";

type VerifyEmailState = {
  devVerificationUrl?: string | null;
  email?: string;
} | null;

export function VerifyEmailPage({
  theme,
  toggleTheme,
  viewer,
}: {
  theme: ThemeMode;
  toggleTheme: () => void;
  viewer: ViewerSummary | null;
}) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [devVerificationUrl, setDevVerificationUrl] = useState<string | null>(() => {
    const state = location.state as VerifyEmailState;
    return state?.devVerificationUrl ?? null;
  });

  const email = useMemo(() => {
    if (viewer?.email) {
      return viewer.email;
    }
    const state = location.state as VerifyEmailState;
    return state?.email ?? "";
  }, [location.state, viewer?.email]);

  const token = searchParams.get("token");

  const verifyMutation = useMutation({
    mutationFn: verifyEmailToken,
    onSuccess: async () => {
      setStatus("success");
      setStatusMessage("Your email has been verified. You can continue using Melon Meet.");
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (error: Error) => {
      setStatus("error");
      setStatusMessage(error.message);
    },
  });

  const resendMutation = useMutation({
    mutationFn: resendVerificationEmail,
    onSuccess: (response) => {
      setStatus("idle");
      setStatusMessage("A new verification email has been prepared.");
      setDevVerificationUrl(response.devVerificationUrl ?? null);
    },
    onError: (error: Error) => {
      setStatus("error");
      setStatusMessage(error.message);
    },
  });

  useEffect(() => {
    if (!token || verifyMutation.isPending || verifyMutation.isSuccess) {
      return;
    }
    verifyMutation.mutate(token);
  }, [token, verifyMutation]);

  if (viewer?.emailVerified) {
    return <Navigate replace to="/map" />;
  }

  return (
    <LaunchFlowLayout
      description={
        email
          ? `We need to verify ${email} before this account can participate in groups, sessions, claims, and posts.`
          : "We need to verify your email before this account can participate in groups, sessions, claims, and posts."
      }
      eyebrow="Email verification"
      theme={theme}
      title="Verify your email before you start creating and joining things."
      toggleTheme={toggleTheme}
    >
      <PanelCard className="launch-flow-card stack-md">
        <p className="muted-copy">
          You can still keep browsing, but participation stays locked until verification is complete.
        </p>

        <div className="launch-flow-divider" />

        <div className="stack-md">
          <div className="stack-sm">
            <p className="eyebrow">Next step</p>
            <h2 className="section-title">
              {token
                ? verifyMutation.isPending
                  ? "Verifying your email"
                  : status === "success"
                    ? "Email verified"
                    : "Verification issue"
                : "Check your inbox"}
            </h2>
          </div>

          <p className="muted-copy">
            {token
              ? verifyMutation.isPending
                ? "Please wait while we confirm your verification link."
                : statusMessage || "Use the button below if you need another verification email."
              : "Open the verification link from your email. If you did not receive one, request another message below."}
          </p>

          {status === "error" ? (
            <p className="empty-state" style={{ color: "var(--danger)", borderStyle: "solid" }}>
              {statusMessage}
            </p>
          ) : null}

          {status === "success" ? (
            <div className="form-actions form-actions--start">
              <Link className="button-primary" to="/map">
                Continue to the app
              </Link>
            </div>
          ) : (
            <div className="form-actions form-actions--start">
              {viewer ? (
                <button className="button-primary" disabled={resendMutation.isPending} onClick={() => resendMutation.mutate()} type="button">
                  {resendMutation.isPending ? "Sending" : "Resend verification email"}
                </button>
              ) : (
                <Link className="button-primary" to="/">
                  Back to sign in
                </Link>
              )}
            </div>
          )}

          {devVerificationUrl ? (
            <div className="stack-sm">
              <p className="eyebrow">Local development</p>
              <a className="muted-copy" href={devVerificationUrl}>
                Open verification link
              </a>
            </div>
          ) : null}
        </div>
      </PanelCard>
    </LaunchFlowLayout>
  );
}
