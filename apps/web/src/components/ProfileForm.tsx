import { useState } from "react";
import type { ViewerSummary } from "../../../../packages/shared/src";

export function ProfileForm({
  profile,
  onSubmit,
}: {
  onSubmit: (payload: {
    avatarUrl: string;
    bio: string;
    displayName: string;
    homeArea: string;
  }) => Promise<unknown>;
  profile: ViewerSummary;
}) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio);
  const [homeArea, setHomeArea] = useState(profile.homeArea);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({ avatarUrl, bio, displayName, homeArea });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
      <label className="space-y-2">
        <span className="text-sm font-medium text-stone-600">Display name</span>
        <input className="block w-full rounded-2xl border-stone-200 bg-stone-50 px-4 py-3 text-sm" onChange={(event) => setDisplayName(event.target.value)} required value={displayName} />
      </label>
      <label className="space-y-2">
        <span className="text-sm font-medium text-stone-600">Home area</span>
        <input className="block w-full rounded-2xl border-stone-200 bg-stone-50 px-4 py-3 text-sm" onChange={(event) => setHomeArea(event.target.value)} value={homeArea} />
      </label>
      <label className="space-y-2 md:col-span-2">
        <span className="text-sm font-medium text-stone-600">Avatar URL</span>
        <input className="block w-full rounded-2xl border-stone-200 bg-stone-50 px-4 py-3 text-sm" onChange={(event) => setAvatarUrl(event.target.value)} type="url" value={avatarUrl} />
      </label>
      <label className="space-y-2 md:col-span-2">
        <span className="text-sm font-medium text-stone-600">Bio</span>
        <textarea className="block min-h-28 w-full rounded-2xl border-stone-200 bg-stone-50 px-4 py-3 text-sm" onChange={(event) => setBio(event.target.value)} value={bio} />
      </label>
      <div className="md:col-span-2 flex justify-end">
        <button className="rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting}>
          {submitting ? "Saving..." : "Save profile"}
        </button>
      </div>
    </form>
  );
}
