import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyTextButton({ label = "Copy", value }: { label?: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button className={`button-secondary button-inline ${copied ? "is-copied" : ""}`.trim()} onClick={handleCopy} type="button">
      {copied ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={2} />}
      <span>{copied ? "Copied" : label}</span>
    </button>
  );
}
