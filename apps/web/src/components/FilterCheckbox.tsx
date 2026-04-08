import { Check } from "lucide-react";

export function FilterCheckbox({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={`filter-checkbox ${checked ? "is-checked" : ""}`.trim()}>
      <input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      <span className="filter-checkbox__box">
        <Check size={12} strokeWidth={2.4} />
      </span>
      <span className="filter-checkbox__label">{label}</span>
    </label>
  );
}
