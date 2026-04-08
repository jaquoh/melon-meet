import { useState } from "react";

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
        <span className="field-label">Name</span>
        <input className="field-input" onChange={(event) => setName(event.target.value)} required value={name} />
      </label>

      <label className="field-stack">
        <span className="field-label">Slug</span>
        <input
          className="field-input"
          onChange={(event) => setSlug(event.target.value)}
          pattern="[a-z0-9-]+"
          required
          value={slug}
        />
      </label>

      <label className="field-stack">
        <span className="field-label">Activity label</span>
        <input className="field-input" onChange={(event) => setActivityLabel(event.target.value)} value={activityLabel} />
      </label>

      <label className="field-stack">
        <span className="field-label">Visibility</span>
        <select className="field-select" onChange={(event) => setVisibility(event.target.value as "public" | "private")} value={visibility}>
          <option value="public">Public</option>
          <option value="private">Private</option>
        </select>
      </label>

      <label className="field-stack field-full">
        <span className="field-label">Description</span>
        <textarea className="field-area" onChange={(event) => setDescription(event.target.value)} required value={description} />
      </label>

      <label className="field-stack field-full">
        <span className="field-label">Hero image URL</span>
        <input className="field-input" onChange={(event) => setHeroImageUrl(event.target.value)} placeholder="https://..." type="url" value={heroImageUrl} />
      </label>

      <label className="field-stack field-full">
        <span className="field-label">Messenger URL</span>
        <input className="field-input" onChange={(event) => setMessengerUrl(event.target.value)} placeholder="https://t.me/..." type="url" value={messengerUrl} />
      </label>

    </form>
  );
}
