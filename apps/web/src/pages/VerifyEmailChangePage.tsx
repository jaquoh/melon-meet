import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import type { ThemeMode } from "../App";
import { LaunchFlowLayout } from "../components/LaunchFlowLayout";
import { PanelCard } from "../components/PanelCard";
import { verifyEmailChangeToken } from "../lib/api";
import { queryClient } from "../lib/query-client";

export function VerifyEmailChangePage({
  theme,
  toggleTheme,
}: {
  theme: ThemeMode;
  toggleTheme: () => void;
}) {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const token = searchParams.get("token");

  const verifyMutation = useMutation({
    mutationFn: verifyEmailChangeToken,
    onSuccess: async (response) => {
      setStatus("success");
      setStatusMessage(`Your account email is now ${response.email}.`);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
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

  return (
    <LaunchFlowLayout
      description="Confirm the new email address for your account. This keeps the old address active until the new one is verified."
      eyebrow="Verify new email"
      theme={theme}
      title="Finish the email change before we switch your account over."
      toggleTheme={toggleTheme}
    >
      <PanelCard className="launch-flow-card stack-md">
        <div className="stack-sm">
          <p className="eyebrow">Status</p>
          <h2 className="section-title">
            {!token
              ? "Missing verification token"
              : verifyMutation.isPending
                ? "Verifying new email"
                : status === "success"
                  ? "Email updated"
                  : "Verification issue"}
          </h2>
        </div>

        <p className="muted-copy">
          {!token
            ? "This email change link is missing its token."
            : verifyMutation.isPending
              ? "Please wait while we verify the new email address."
              : statusMessage || "Open the verification link from your new email address."}
        </p>

        {status === "success" ? (
          <div className="form-actions form-actions--start">
            <Link className="button-primary" to="/map">
              Back to the app
            </Link>
          </div>
        ) : null}

        {status === "error" || !token ? (
          <div className="form-actions form-actions--start">
            <Link className="button-primary" to="/map">
              Back to the app
            </Link>
          </div>
        ) : null}
      </PanelCard>
    </LaunchFlowLayout>
  );
}
