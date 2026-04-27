import { useState } from "react";
import { formatDateTime } from "../lib/format";
import { useI18n } from "../lib/i18n";
import { PanelCard } from "./PanelCard";

interface PostBoardProps {
  buttonLabel?: string;
  canPost: boolean;
  compact?: boolean;
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
  compact = false,
  emptyLabel,
  onSubmit,
  posts,
  title,
}: PostBoardProps) {
  const { locale, t } = useI18n();
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
    <PanelCard className={`stack-md ${compact ? "pinboard pinboard--compact" : "pinboard"}`.trim()}>
      <div className="pinboard__header">
        <p className="eyebrow">{t("postBoard.pinboard")}</p>
        <h3 className="detail-title">{title}</h3>
      </div>

      {canPost ? (
        <form className="stack-sm pinboard__form" onSubmit={handleSubmit}>
          <textarea
            className="field-area"
            onChange={(event) => setContent(event.target.value)}
            placeholder={t("postBoard.placeholder")}
            value={content}
          />
          <div className="form-actions">
            <button className="button-primary" disabled={submitting}>
              {submitting ? t("postBoard.sending") : buttonLabel}
            </button>
          </div>
        </form>
      ) : null}

      <div className="stack-sm pinboard__posts">
        {posts.length === 0 ? (
          <p className="empty-state">{emptyLabel}</p>
        ) : (
          posts.map((post) => (
            <article className="terminal-item" key={post.id}>
              <div className="terminal-item__row">
                <p className="terminal-item__title">{post.author.displayName}</p>
                <p className="terminal-item__meta">{formatDateTime(post.createdAt, locale)}</p>
              </div>
              <p className="pinboard__message">
                {post.content}
              </p>
            </article>
          ))
        )}
      </div>
    </PanelCard>
  );
}
