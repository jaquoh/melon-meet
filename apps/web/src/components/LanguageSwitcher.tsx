import { Languages } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getLanguageOption, SUPPORTED_LOCALES, useI18n } from "../lib/i18n";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const current = getLanguageOption(locale);
  const currentCode = current.code.split("-")[1] ?? current.code;

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) {
        return;
      }
      setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div className={`language-switcher ${compact ? "language-switcher--compact" : ""}`.trim()} ref={rootRef}>
      <button
        aria-expanded={open}
        aria-label={t("common.language")}
        className="language-switcher__trigger"
        onClick={() => setOpen((currentValue) => !currentValue)}
        type="button"
      >
        <Languages className="language-switcher__icon" size={16} strokeWidth={2} />
        <span className="language-switcher__current-label">{currentCode}</span>
      </button>

      {open ? (
        <div className="language-switcher__panel" role="menu">
          {SUPPORTED_LOCALES.map((option) => (
            <button
              className={`language-switcher__option ${option.code === locale ? "is-active" : ""}`.trim()}
              key={option.code}
              onClick={() => {
                setLocale(option.code);
                setOpen(false);
              }}
              role="menuitemradio"
              type="button"
            >
              <span className="language-switcher__option-flag" aria-hidden="true">
                {option.flag}
              </span>
              <span className="language-switcher__option-copy">
                <span>{option.label}</span>
                <span>{option.code}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
