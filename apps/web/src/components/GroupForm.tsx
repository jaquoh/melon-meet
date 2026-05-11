import { useState } from "react";
import { useI18n } from "../lib/i18n";
import { FormInput } from "./FormInput";

interface GroupFormProps {
  formId?: string;
  initialValues?: {
    activityLabel?: string | null;
    description: string;
    heroImageUrl?: string | null;
    messengerUrl?: string | null;
    name: string;
    slug: string;
    visibility: "public" | "private";
  };
  onSubmit: (payload: {
    activityLabel?: string | null;
    description: string;
    heroImageUrl?: string | null;
    messengerUrl?: string | null;
    name: string;
    slug: string;
    visibility: "public" | "private";
  }) => Promise<unknown>;
}

export function GroupForm({ formId, initialValues, onSubmit }: GroupFormProps) {
  const { t, formatVisibility } = useI18n();
  const [name, setName] = useState(initialValues?.name ?? "");
  const [slug, setSlug] = useState(initialValues?.slug ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [activityLabel, setActivityLabel] = useState(initialValues?.activityLabel ?? "Beach volleyball");
  const [heroImageUrl, setHeroImageUrl] = useState(initialValues?.heroImageUrl ?? "");
  const [messengerUrl, setMessengerUrl] = useState(initialValues?.messengerUrl ?? "");
  const [visibility, setVisibility] = useState<"public" | "private">(
    initialValues?.visibility ?? "public",
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        activityLabel,
        description,
        heroImageUrl,
        messengerUrl,
        name,
        slug,
        visibility,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="form-grid form-grid--two" id={formId} onSubmit={handleSubmit}>
      <label className="field-stack">
        <span className="field-label">{t("forms.name")}</span>
        <FormInput onChange={setName} required value={name} />
      </label>

      <label className="field-stack">
        <span className="field-label">{t("forms.slug")}</span>
        <FormInput onChange={setSlug} pattern="[a-z0-9-]+" required value={slug} />
      </label>

      <label className="field-stack">
        <span className="field-label">{t("forms.activityLabel")}</span>
        <FormInput onChange={setActivityLabel} value={activityLabel} />
      </label>

      <label className="field-stack">
        <span className="field-label">{t("forms.visibility")}</span>
        <select className="field-select" onChange={(event) => setVisibility(event.target.value as "public" | "private")} value={visibility}>
          <option value="public">{formatVisibility("public")}</option>
          <option value="private">{formatVisibility("private")}</option>
        </select>
      </label>

      <label className="field-stack field-full">
        <span className="field-label">{t("forms.description")}</span>
        <textarea className="field-area" onChange={(event) => setDescription(event.target.value)} required value={description} />
      </label>

      <label className="field-stack field-full">
        <span className="field-label">{t("forms.heroImageUrl")}</span>
        <FormInput onChange={setHeroImageUrl} placeholder="https://..." type="url" value={heroImageUrl} />
      </label>

      <label className="field-stack field-full">
        <span className="field-label">{t("forms.messengerUrl")}</span>
        <FormInput onChange={setMessengerUrl} placeholder="https://t.me/..." type="url" value={messengerUrl} />
      </label>

    </form>
  );
}
