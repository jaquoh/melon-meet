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
    <PanelCard className="stack-md">
      <div>
        <p className="eyebrow">Pinboard</p>
        <h3 className="detail-title">{title}</h3>
      </div>

      {canPost ? (
        <form className="stack-sm" onSubmit={handleSubmit}>
          <textarea
            className="field-area"
            onChange={(event) => setContent(event.target.value)}
            placeholder="Share a quick update, game note, or meetup detail..."
            value={content}
          />
          <div className="form-actions">
            <button className="button-primary" disabled={submitting}>
              {submitting ? "Sending" : buttonLabel}
            </button>
          </div>
        </form>
      ) : null}

      <div className="stack-sm">
        {posts.length === 0 ? (
          <p className="empty-state">{emptyLabel}</p>
        ) : (
          posts.map((post) => (
            <article className="terminal-item" key={post.id}>
              <div className="terminal-item__row">
                <p className="terminal-item__title">{post.author.displayName}</p>
                <p className="terminal-item__meta">{formatDateTime(post.createdAt)}</p>
              </div>
              <p className="muted-copy" style={{ whiteSpace: "pre-wrap" }}>
                {post.content}
              </p>
            </article>
          ))
        )}
      </div>
    </PanelCard>
  );
}
