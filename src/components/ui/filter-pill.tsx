import { cn } from "@/lib/utils";

export function FilterPill({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md border border-edge bg-surface-1 pl-2 pr-1 text-[11px] text-content-muted transition-colors hover:border-edge-strong focus-within:border-accent/60",
        className,
      )}
    >
      <span className="text-content-faint">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        className="wm-focus-ring cursor-pointer appearance-none bg-transparent py-0.5 pr-1 text-[11px] font-medium text-content outline-none"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue} className="bg-surface-1 text-content">
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
