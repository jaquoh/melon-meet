import { Eye, EyeOff, X } from "lucide-react";
import { useId, useState } from "react";

export function FormInput({
  autoComplete,
  className = "field-input",
  disabled,
  inputMode,
  max,
  maxLength,
  min,
  minLength,
  name,
  onChange,
  pattern,
  placeholder,
  required,
  step,
  title,
  type = "text",
  value,
}: {
  autoComplete?: string;
  className?: string;
  disabled?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  max?: number | string;
  maxLength?: number;
  min?: number | string;
  minLength?: number;
  name?: string;
  onChange: (value: string) => void;
  pattern?: string;
  placeholder?: string;
  required?: boolean;
  step?: number | string;
  title?: string;
  type?: React.HTMLInputTypeAttribute;
  value: string;
}) {
  const generatedName = useId();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const clearable = !disabled && value.length > 0;
  const revealable = type === "password";
  const resolvedType = revealable ? (passwordVisible ? "text" : "password") : type;
  const hasTrailingActions = clearable || revealable;

  return (
    <span className={`field-input-shell ${disabled ? "is-disabled" : ""}`.trim()}>
      <input
        autoComplete={autoComplete}
        className={`${className} ${hasTrailingActions ? "field-input--with-trailing-actions" : ""}`.trim()}
        disabled={disabled}
        inputMode={inputMode}
        max={max}
        maxLength={maxLength}
        min={min}
        minLength={minLength}
        name={name ?? generatedName}
        onChange={(event) => onChange(event.target.value)}
        pattern={pattern}
        placeholder={placeholder}
        required={required}
        step={step}
        title={title}
        type={resolvedType}
        value={value}
      />
      {hasTrailingActions ? (
        <span className="field-input-shell__actions">
          {clearable ? (
            <button
              aria-label="Clear input"
              className="field-input-shell__action"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onChange("")}
              type="button"
            >
              <X size={14} strokeWidth={2.2} />
            </button>
          ) : null}
          {revealable ? (
            <button
              aria-label={passwordVisible ? "Hide password" : "Show password"}
              className="field-input-shell__action"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setPasswordVisible((current) => !current)}
              type="button"
            >
              {passwordVisible ? <EyeOff size={14} strokeWidth={2.2} /> : <Eye size={14} strokeWidth={2.2} />}
            </button>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
