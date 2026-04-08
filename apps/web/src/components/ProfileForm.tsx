import { useState } from "react";
import type { ViewerSummary } from "../../../../packages/shared/src";
import { FilterCheckbox } from "./FilterCheckbox";

export function ProfileForm({
  profile,
  onSubmit,
}: {
  onSubmit: (payload: {
    avatarUrl: string;
    bio: string;
    displayName: string;
    homeArea: string;
    isProfilePublic: boolean;
    showEmailPublicly: boolean;
  }) => Promise<unknown>;
  profile: ViewerSummary;
}) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio);
  const [homeArea, setHomeArea] = useState(profile.homeArea);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? "");
  const [isProfilePublic, setIsProfilePublic] = useState(profile.isProfilePublic);
  const [showEmailPublicly, setShowEmailPublicly] = useState(profile.showEmailPublicly);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({ avatarUrl, bio, displayName, homeArea, isProfilePublic, showEmailPublicly });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="form-grid form-grid--two" onSubmit={handleSubmit}>
      <label className="field-stack">
        <span className="field-label">Display name</span>
        <input className="field-input" onChange={(event) => setDisplayName(event.target.value)} required value={displayName} />
      </label>

      <label className="field-stack">
        <span className="field-label">Home area</span>
        <input className="field-input" onChange={(event) => setHomeArea(event.target.value)} value={homeArea} />
      </label>

      <label className="field-stack field-full">
        <span className="field-label">Avatar URL</span>
        <input className="field-input" onChange={(event) => setAvatarUrl(event.target.value)} type="url" value={avatarUrl} />
      </label>

      <label className="field-stack field-full">
        <span className="field-label">Bio</span>
        <textarea className="field-area" onChange={(event) => setBio(event.target.value)} value={bio} />
      </label>

      <div className="field-full">
        <FilterCheckbox checked={isProfilePublic} label="Public profile" onChange={setIsProfilePublic} />
      </div>

      <div className="field-full">
        <FilterCheckbox checked={showEmailPublicly} label="Show email publicly" onChange={setShowEmailPublicly} />
      </div>

      <div className="form-actions field-full">
        <button className="button-primary" disabled={submitting}>
          {submitting ? "Saving" : "Save profile"}
        </button>
      </div>
    </form>
  );
}
