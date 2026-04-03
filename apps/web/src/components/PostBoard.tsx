import { useState } from "react";
import { formatDateTime } from "../lib/format";
import { PanelCard } from "./PanelCard";

interface PostBoardProps {
  buttonLabel?: string;
  canPost: boolean;
  emptyLabel: string;
  onSubmit: (content: string) => Promise<unknown>;
  posts: Array<{
    author: { displayName: string };
    content: string;
    createdAt: string;
    id: string;
  }>;
  title: string;
}

export function PostBoard({
  buttonLabel = "Post",
  canPost,
  emptyLabel,
  onSubmit,
  posts,
  title,
}: PostBoardProps) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(content.trim());
      setContent("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PanelCard>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-500">
            Pinboard
          </p>
          <h3 className="mt-1 text-xl font-semibold text-stone-900">{title}</h3>
        </div>
      </div>

      {canPost ? (
        <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
          <textarea
            className="block min-h-28 w-full rounded-3xl border-stone-200 bg-stone-50/90 px-4 py-3 text-sm"
            onChange={(event) => setContent(event.target.value)}
            placeholder="Share a quick update, game note, or meetup detail..."
            value={content}
          />
          <button className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting}>
            {submitting ? "Sending..." : buttonLabel}
          </button>
        </form>
      ) : null}

      <div className="mt-5 space-y-3">
        {posts.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-stone-200 bg-stone-50 px-4 py-5 text-sm text-stone-500">
            {emptyLabel}
          </p>
        ) : (
          posts.map((post) => (
            <article className="rounded-3xl border border-stone-200/80 bg-stone-50/80 px-4 py-4" key={post.id}>
              <div className="flex items-center justify-between gap-4">
                <p className="font-medium text-stone-900">{post.author.displayName}</p>
                <p className="text-xs text-stone-500">{formatDateTime(post.createdAt)}</p>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-600">{post.content}</p>
            </article>
          ))
        )}
      </div>
    </PanelCard>
  );
}
