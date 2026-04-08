import type { ReactNode } from "react";
import { Image as ImageIcon } from "lucide-react";

export function DetailHero({
  children,
  description,
  eyebrow,
  imageUrl,
  meta,
  title,
}: {
  children?: ReactNode;
  description?: string | null;
  eyebrow: string;
  imageUrl?: string | null;
  meta?: ReactNode;
  title: string;
}) {
  return (
    <section className="detail-hero">
      <div className={`detail-hero__media ${imageUrl ? "has-image" : ""}`.trim()}>
        {imageUrl ? <img alt={title} className="detail-hero__image" src={imageUrl} /> : null}
        <div className="detail-hero__fallback" aria-hidden={Boolean(imageUrl)}>
          <ImageIcon size={24} strokeWidth={1.8} />
        </div>
      </div>
      <div className="detail-hero__content">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="display-title typewriter-title detail-hero__title">{title}</h1>
        {description ? <p className="detail-hero__description">{description}</p> : null}
        {meta ? <div className="detail-hero__meta">{meta}</div> : null}
        {children ? <div className="detail-hero__actions">{children}</div> : null}
      </div>
    </section>
  );
}
