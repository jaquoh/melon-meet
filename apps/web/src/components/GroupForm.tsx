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
    <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
      <label className="space-y-2">
        <span className="text-sm font-medium text-stone-600">Name</span>
        <input className="block w-full rounded-2xl border-stone-200 bg-stone-50 px-4 py-3 text-sm" onChange={(event) => setName(event.target.value)} required value={name} />
      </label>

      <label className="space-y-2">
        <span className="text-sm font-medium text-stone-600">Slug</span>
        <input className="block w-full rounded-2xl border-stone-200 bg-stone-50 px-4 py-3 text-sm" onChange={(event) => setSlug(event.target.value)} pattern="[a-z0-9-]+" required value={slug} />
      </label>

      <label className="space-y-2">
        <span className="text-sm font-medium text-stone-600">Activity label</span>
        <input className="block w-full rounded-2xl border-stone-200 bg-stone-50 px-4 py-3 text-sm" onChange={(event) => setActivityLabel(event.target.value)} value={activityLabel} />
      </label>

      <label className="space-y-2">
        <span className="text-sm font-medium text-stone-600">Visibility</span>
        <select className="block w-full rounded-2xl border-stone-200 bg-stone-50 px-4 py-3 text-sm" onChange={(event) => setVisibility(event.target.value as "public" | "private")} value={visibility}>
          <option value="public">Public</option>
          <option value="private">Private</option>
        </select>
      </label>

      <label className="space-y-2 md:col-span-2">
        <span className="text-sm font-medium text-stone-600">Description</span>
        <textarea className="block min-h-32 w-full rounded-2xl border-stone-200 bg-stone-50 px-4 py-3 text-sm" onChange={(event) => setDescription(event.target.value)} required value={description} />
      </label>

      <div className="md:col-span-2 flex justify-end">
        <button className="rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting}>
          {submitting ? "Saving..." : initialValues ? "Save group" : "Create group"}
        </button>
      </div>
    </form>
  );
}
