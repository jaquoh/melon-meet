import { useState } from "react";
import { FormInput } from "./FormInput";

export function ChangePasswordForm({
  onSubmit,
}: {
  onSubmit: (payload: { currentPassword: string; password: string }) => Promise<unknown>;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (passwordMismatch) {
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({ currentPassword, password });
      setCurrentPassword("");
      setPassword("");
      setConfirmPassword("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <label className="field-stack">
        <span className="field-label">Current password</span>
        <FormInput autoComplete="current-password" onChange={setCurrentPassword} required type="password" value={currentPassword} />
      </label>

      <label className="field-stack">
        <span className="field-label">New password</span>
        <FormInput autoComplete="new-password" minLength={8} onChange={setPassword} required type="password" value={password} />
      </label>

      <label className="field-stack">
        <span className="field-label">Confirm new password</span>
        <FormInput autoComplete="new-password" minLength={8} onChange={setConfirmPassword} required type="password" value={confirmPassword} />
      </label>

      {passwordMismatch ? (
        <p className="empty-state" style={{ color: "var(--danger)", borderStyle: "solid" }}>
          The two new passwords do not match.
        </p>
      ) : null}

      <div className="form-actions form-actions--start">
        <button className="button-primary" disabled={submitting || passwordMismatch}>
          {submitting ? "Saving" : "Change password"}
        </button>
      </div>
    </form>
  );
}
