import { useState } from "react";

interface GroupFormProps {
  initialValues?: {
    activityLabel?: string | null;
    description: string;
    name: string;
    slug: string;
    visibility: "public" | "private";
  };
  onSubmit: (payload: {
    activityLabel?: string | null;
    description: string;
    name: string;
    slug: string;
    visibility: "public" | "private";
  }) => Promise<unknown>;
}

export function GroupForm({ initialValues, onSubmit }: GroupFormProps) {
  const [name, setName] = useState(initialValues?.name ?? "");
  const [slug, setSlug] = useState(initialValues?.slug ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [activityLabel, setActivityLabel] = useState(initialValues?.activityLabel ?? "Beach volleyball");
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
        name,
        slug,
        visibility,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="form-grid form-grid--two" onSubmit={handleSubmit}>
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

      <div className="form-actions field-full">
        <button className="button-primary" disabled={submitting}>
          {submitting ? "Saving" : initialValues ? "Save group" : "Create group"}
        </button>
      </div>
    </form>
  );
}
