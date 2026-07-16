import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export function normalizeGalleryImages(imageUrls: Array<string | null | undefined>) {
  const normalized = imageUrls.map((url) => url?.trim() ?? "").filter(Boolean);
  return normalized.filter((url, index) => normalized.indexOf(url) === index);
}

export function nextGalleryIndex(current: number, direction: -1 | 1, imageCount: number) {
  if (imageCount <= 0) return 0;
  return (current + direction + imageCount) % imageCount;
}

interface ImageGalleryProps {
  className?: string;
  fallback?: ReactNode;
  imageUrls: Array<string | null | undefined>;
  onOpenFullscreen: (imageUrls: string[], initialIndex: number) => void;
  title: string;
}

export function ImageGallery({ className = "", fallback, imageUrls, onOpenFullscreen, title }: ImageGalleryProps) {
  const images = useMemo(() => normalizeGalleryImages(imageUrls), [imageUrls]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setCurrentIndex((index) => Math.min(index, Math.max(0, images.length - 1)));
  }, [images.length]);

  function move(direction: -1 | 1) {
    setCurrentIndex((index) => nextGalleryIndex(index, direction, images.length));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      move(event.key === "ArrowLeft" ? -1 : 1);
    }
  }

  if (images.length === 0) {
    return <div className={`detail-hero__media info-panel__hero ${className}`.trim()}>{fallback ?? <div className="detail-hero__fallback" aria-hidden="true" />}</div>;
  }

  const currentImage = images[currentIndex];
  return (
    <div
      aria-label={`${title} image gallery`}
      className={`detail-hero__media info-panel__hero has-image image-gallery ${className}`.trim()}
      onKeyDown={handleKeyDown}
      role="group"
      tabIndex={0}
    >
      <button
        aria-label={`Open image ${currentIndex + 1} of ${images.length} for ${title}`}
        className="image-gallery__open"
        onClick={() => onOpenFullscreen(images, currentIndex)}
        type="button"
      >
        <img alt={`${title} — image ${currentIndex + 1} of ${images.length}`} className="detail-hero__image" src={currentImage} />
      </button>
      {images.length > 1 ? (
        <>
          <button aria-label="Previous image" className="image-gallery__arrow image-gallery__arrow--previous" onClick={() => move(-1)} type="button">
            <ChevronLeft size={20} strokeWidth={2.2} />
          </button>
          <button aria-label="Next image" className="image-gallery__arrow image-gallery__arrow--next" onClick={() => move(1)} type="button">
            <ChevronRight size={20} strokeWidth={2.2} />
          </button>
          <span aria-live="polite" className="image-gallery__count">{currentIndex + 1} / {images.length}</span>
        </>
      ) : null}
    </div>
  );
}

interface FullscreenImageGalleryProps {
  imageUrls: string[];
  initialIndex: number;
  onClose: () => void;
  quote: string;
  title: string;
}

export function FullscreenImageGallery({ imageUrls, initialIndex, onClose, quote, title }: FullscreenImageGalleryProps) {
  const images = useMemo(() => normalizeGalleryImages(imageUrls), [imageUrls]);
  const [currentIndex, setCurrentIndex] = useState(Math.min(initialIndex, Math.max(0, images.length - 1)));
  const scrollerRef = useRef<HTMLDivElement>(null);

  function move(direction: -1 | 1) {
    setCurrentIndex((index) => nextGalleryIndex(index, direction, images.length));
  }

  useEffect(() => {
    scrollerRef.current?.scrollTo({ left: 0 });
  }, [currentIndex]);

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        move(event.key === "ArrowLeft" ? -1 : 1);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  });

  if (images.length === 0) return null;

  return (
    <div aria-label={`${title} fullscreen image gallery`} aria-modal="true" className="fullscreen-image-view" role="dialog">
      <div className="fullscreen-image-view__scroller" ref={scrollerRef}>
        <img alt={`${title} — image ${currentIndex + 1} of ${images.length}`} className="fullscreen-image-view__image" src={images[currentIndex]} />
      </div>
      <h2 className="fullscreen-image-view__title">{title}</h2>
      <p className="fullscreen-image-view__quote">{quote}</p>
      {images.length > 1 ? (
        <>
          <button aria-label="Previous image" className="image-gallery__arrow fullscreen-image-view__arrow fullscreen-image-view__arrow--previous" onClick={() => move(-1)} type="button">
            <ChevronLeft size={24} strokeWidth={2.2} />
          </button>
          <button aria-label="Next image" className="image-gallery__arrow fullscreen-image-view__arrow fullscreen-image-view__arrow--next" onClick={() => move(1)} type="button">
            <ChevronRight size={24} strokeWidth={2.2} />
          </button>
          <span aria-live="polite" className="image-gallery__count fullscreen-image-view__count">{currentIndex + 1} / {images.length}</span>
        </>
      ) : null}
      <button aria-label="Close fullscreen gallery" className="button-secondary workspace-panel-close-square fullscreen-image-view__close" onClick={onClose} type="button">
        <X size={16} strokeWidth={2} />
      </button>
    </div>
  );
}
