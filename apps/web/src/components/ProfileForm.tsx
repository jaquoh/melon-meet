import { useState } from "react";
import { FilterCheckbox } from "./FilterCheckbox";

export interface ProfileFormValues {
  avatarUrl: string;
  bio: string;
  displayName: string;
  homeArea: string;
  isProfilePublic: boolean;
  showEmailPublicly: boolean;
}

export function ProfileForm({
  formId,
  onChange,
  profile,
  onSubmit,
}: {
  formId?: string;
  onChange: (next: ProfileFormValues) => void;
  onSubmit: (payload: {
    avatarUrl: string;
    bio: string;
    displayName: string;
    homeArea: string;
    isProfilePublic: boolean;
    showEmailPublicly: boolean;
  }) => Promise<unknown>;
  profile: ProfileFormValues;
}) {
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(profile);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="form-grid form-grid--two" id={formId} onSubmit={handleSubmit}>
      <label className="field-stack">
        <span className="field-label">Display name</span>
        <input
          className="field-input"
          onChange={(event) => onChange({ ...profile, displayName: event.target.value })}
          required
          value={profile.displayName}
        />
      </label>

      <label className="field-stack">
        <span className="field-label">Home area</span>
        <input className="field-input" onChange={(event) => onChange({ ...profile, homeArea: event.target.value })} value={profile.homeArea} />
      </label>

      <label className="field-stack field-full">
        <span className="field-label">Avatar URL</span>
        <input
          className="field-input"
          onChange={(event) => onChange({ ...profile, avatarUrl: event.target.value })}
          type="url"
          value={profile.avatarUrl}
        />
      </label>

      <label className="field-stack field-full">
        <span className="field-label">Bio</span>
        <textarea className="field-area" onChange={(event) => onChange({ ...profile, bio: event.target.value })} value={profile.bio} />
      </label>

      <div className="field-full">
        <FilterCheckbox
          checked={profile.isProfilePublic}
          label="Public profile"
          onChange={(checked) => onChange({ ...profile, isProfilePublic: checked })}
        />
      </div>

      <div className="field-full">
        <FilterCheckbox
          checked={profile.showEmailPublicly}
          label="Show email publicly"
          onChange={(checked) => onChange({ ...profile, showEmailPublicly: checked })}
        />
      </div>
    </form>
  );
}
