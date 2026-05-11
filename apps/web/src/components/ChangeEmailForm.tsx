import { useState } from "react";
import { FormInput } from "./FormInput";

export function ChangeEmailForm({
  currentEmail,
  onSubmit,
}: {
  currentEmail: string;
  onSubmit: (payload: { currentPassword: string; email: string }) => Promise<unknown>;
}) {
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({ currentPassword, email });
      setEmail("");
      setCurrentPassword("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <p className="muted-copy">Current email: {currentEmail}</p>

      <label className="field-stack">
        <span className="field-label">New email</span>
        <FormInput autoComplete="email" onChange={setEmail} required type="email" value={email} />
      </label>

      <label className="field-stack">
        <span className="field-label">Current password</span>
        <FormInput autoComplete="current-password" onChange={setCurrentPassword} required type="password" value={currentPassword} />
      </label>

      <div className="form-actions form-actions--start">
        <button className="button-primary" disabled={submitting}>
          {submitting ? "Sending" : "Send verification link"}
        </button>
      </div>
    </form>
  );
}
