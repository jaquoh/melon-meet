import { useState } from "react";
import { useI18n } from "../lib/i18n";
import { FilterCheckbox } from "./FilterCheckbox";

const PLAYING_LEVEL_PARTIAL_PATTERN = /^\d*(?:\.\d*)?(?:-\d*(?:\.\d*)?)?$/;

export interface ProfileFormValues {
  avatarUrl: string;
  bio: string;
  displayName: string;
  homeArea: string;
  isProfilePublic: boolean;
  playingLevel: string;
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
    playingLevel: string;
    showEmailPublicly: boolean;
  }) => Promise<unknown>;
  profile: ProfileFormValues;
}) {
  const { t } = useI18n();
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
        <span className="field-label">{t("forms.displayName")}</span>
        <input
          className="field-input"
          onChange={(event) => onChange({ ...profile, displayName: event.target.value })}
          required
          value={profile.displayName}
        />
      </label>

      <label className="field-stack">
        <span className="field-label">{t("forms.homeArea")}</span>
        <input className="field-input" onChange={(event) => onChange({ ...profile, homeArea: event.target.value })} value={profile.homeArea} />
      </label>

      <label className="field-stack">
        <span className="field-label">{t("forms.playingLevel")}</span>
        <input
          className="field-input"
          inputMode="decimal"
          onChange={(event) => {
            const nextValue = event.target.value.trim();
            if (PLAYING_LEVEL_PARTIAL_PATTERN.test(nextValue)) {
              onChange({ ...profile, playingLevel: nextValue });
            }
          }}
          pattern="^\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?$"
          placeholder="3.5-4"
          title={t("forms.passwordTitle")}
          value={profile.playingLevel}
        />
        <span className="field-hint">{t("forms.passwordHint")}</span>
      </label>

      <label className="field-stack field-full">
        <span className="field-label">{t("forms.avatarUrl")}</span>
        <input
          className="field-input"
          onChange={(event) => onChange({ ...profile, avatarUrl: event.target.value })}
          type="url"
          value={profile.avatarUrl}
        />
      </label>

      <label className="field-stack field-full">
        <span className="field-label">{t("forms.bio")}</span>
        <textarea className="field-area" onChange={(event) => onChange({ ...profile, bio: event.target.value })} value={profile.bio} />
      </label>

      <div className="field-full">
        <FilterCheckbox
          checked={profile.isProfilePublic}
          label={t("forms.publicProfile")}
          onChange={(checked) => onChange({ ...profile, isProfilePublic: checked })}
        />
      </div>

      <div className="field-full">
        <FilterCheckbox
          checked={profile.showEmailPublicly}
          label={t("forms.showEmailPublicly")}
          onChange={(checked) => onChange({ ...profile, showEmailPublicly: checked })}
        />
      </div>
    </form>
  );
}
