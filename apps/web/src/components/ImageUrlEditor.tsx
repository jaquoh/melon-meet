import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

interface ImageUrlEditorProps {
  hint?: string;
  imageUrls: string[];
  label?: string;
  maxImages?: number;
  onChange: (imageUrls: string[]) => void;
}

export function ImageUrlEditor({
  hint = "The first image is used as the cover. Add public HTTPS image URLs.",
  imageUrls,
  label = "Images",
  maxImages = 12,
  onChange,
}: ImageUrlEditorProps) {
  function update(index: number, value: string) {
    onChange(imageUrls.map((url, itemIndex) => itemIndex === index ? value : url));
  }

  function remove(index: number) {
    onChange(imageUrls.filter((_, itemIndex) => itemIndex !== index));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= imageUrls.length) return;
    const next = [...imageUrls];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <fieldset className="field-stack field-full image-url-editor">
      <legend className="field-label">{label}</legend>
      <span className="field-hint">{hint}</span>
      {imageUrls.length === 0 ? <p className="muted-copy image-url-editor__empty">No images added.</p> : null}
      <div className="image-url-editor__list">
        {imageUrls.map((url, index) => (
          <div className="image-url-editor__item" key={index}>
            <span className="image-url-editor__position">{index === 0 ? "Cover" : index + 1}</span>
            <input
              aria-label={`${label} ${index + 1} URL`}
              className="field-input"
              onChange={(event) => update(index, event.target.value)}
              placeholder="https://..."
              required
              type="url"
              value={url}
            />
            <div className="image-url-editor__actions">
              <button aria-label={`Move image ${index + 1} up`} className="button-secondary" disabled={index === 0} onClick={() => move(index, -1)} type="button"><ArrowUp size={14} /></button>
              <button aria-label={`Move image ${index + 1} down`} className="button-secondary" disabled={index === imageUrls.length - 1} onClick={() => move(index, 1)} type="button"><ArrowDown size={14} /></button>
              <button aria-label={`Remove image ${index + 1}`} className="button-secondary" onClick={() => remove(index)} type="button"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
      <button
        className="button-secondary button-inline image-url-editor__add"
        disabled={imageUrls.length >= maxImages}
        onClick={() => onChange([...imageUrls, ""])}
        type="button"
      >
        <Plus size={14} /> Add image
      </button>
    </fieldset>
  );
}
