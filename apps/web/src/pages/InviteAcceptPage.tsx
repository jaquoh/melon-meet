import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "react-router-dom";
import type { ViewerSummary } from "../../../../packages/shared/src";
import type { ThemeMode } from "../App";
import { LaunchFlowLayout } from "../components/LaunchFlowLayout";
import { PanelCard } from "../components/PanelCard";
import { acceptInviteCode } from "../lib/api";
import { queryClient } from "../lib/query-client";

export function InviteAcceptPage({
  theme,
  toggleTheme,
  viewer,
}: {
  theme: ThemeMode;
  toggleTheme: () => void;
  viewer: ViewerSummary | null;
}) {
  const { code } = useParams();
  const [joinedGroupId, setJoinedGroupId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");

  const inviteMutation = useMutation({
    mutationFn: acceptInviteCode,
    onSuccess: async (response) => {
      setJoinedGroupId(response.groupId);
      setStatusMessage("You have joined the private group. You can head straight into the group now.");
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      await queryClient.invalidateQueries({ queryKey: ["groups"] });
      await queryClient.invalidateQueries({ queryKey: ["map"] });
      await queryClient.invalidateQueries({ queryKey: ["group", response.groupId] });
    },
    onError: (error: Error) => {
      setStatusMessage(error.message);
    },
  });

  useEffect(() => {
    if (!code || !viewer?.emailVerified || inviteMutation.isPending || inviteMutation.isSuccess) {
      return;
    }
    inviteMutation.mutate(code);
  }, [code, inviteMutation, viewer?.emailVerified]);

  const description = useMemo(() => {
    if (!viewer) {
      return "Private invite links work after you sign in to a verified Melon Meet account.";
    }
    if (!viewer.emailVerified) {
      return "Private invite links work after your Melon Meet account has a verified email address.";
    }
    return "We will check the invite link and add you to the private group if it is still active.";
  }, [viewer]);

  if (!code) {
    return <Navigate replace to="/" />;
  }

  return (
    <LaunchFlowLayout
      description={description}
      eyebrow="Private group invite"
      theme={theme}
      title="Join a private group from an invite link."
      toggleTheme={toggleTheme}
    >
      <PanelCard className="launch-flow-card stack-md">
        {!viewer ? (
          <>
            <p className="muted-copy">Sign in first, then reopen this invite link to finish joining the group.</p>
            <div className="form-actions form-actions--start">
              <Link className="button-primary" to="/">
                Back to sign in
              </Link>
            </div>
          </>
        ) : !viewer.emailVerified ? (
          <>
            <p className="muted-copy">Verify your email before accepting invite links, posting, joining sessions, or claiming spots.</p>
            <div className="form-actions form-actions--start">
              <Link className="button-primary" to="/verify-email">
                Verify email
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="stack-sm">
              <p className="eyebrow">Status</p>
              <h2 className="section-title">
                {inviteMutation.isPending ? "Joining group" : joinedGroupId ? "Invite accepted" : "Invite issue"}
              </h2>
            </div>
            <p className="muted-copy">
              {inviteMutation.isPending
                ? "Please wait while we confirm the invite and add you to the group."
                : statusMessage || "We could not use this invite link."}
            </p>
            {!inviteMutation.isPending && !joinedGroupId ? (
              <p className="empty-state" style={{ color: "var(--danger)", borderStyle: "solid" }}>
                {statusMessage || "Invite link not found."}
              </p>
            ) : null}
            <div className="form-actions form-actions--start">
              {joinedGroupId ? (
                <Link className="button-primary" to={`/groups/${joinedGroupId}`}>
                  Open group
                </Link>
              ) : (
                <Link className="button-secondary" to="/groups">
                  Browse groups
                </Link>
              )}
            </div>
          </>
        )}
      </PanelCard>
    </LaunchFlowLayout>
  );
}
