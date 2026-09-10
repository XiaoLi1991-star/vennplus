import { useState } from 'react';

/** Keep invalid/empty drafts local, so figure settings stay usable while typing. */
export function NumberField({ label, value, min, max, step = 1, unit, disabled = false, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string; disabled?: boolean; onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return <span className="number-field"><input type="number" aria-label={label} min={min} max={max} step={step} disabled={disabled}
    value={draft ?? Number(value.toFixed(3))}
    onChange={(e) => {
      setDraft(e.target.value);
      const number = Number(e.target.value);
      if (e.target.value.trim() && Number.isFinite(number) && number >= min && number <= max) onChange(number);
    }}
    onBlur={() => {
      if (draft?.trim() && Number.isFinite(Number(draft))) onChange(Math.max(min, Math.min(max, Number(draft))));
      setDraft(null);
    }}
    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />{unit ? <span>{unit}</span> : null}</span>;
}
