import { ChevronDown } from "lucide-react";
import { getResponseStatusBadgeStyle } from "@/lib/responseStatus";

interface ResponseStatusSelectProps {
  status: string;
  options: string[];
  label: string;
  disabled?: boolean;
  readOnly?: boolean;
  onChange: (status: string) => void;
}

export function ResponseStatusSelect({ status, options, label, disabled, readOnly, onChange }: ResponseStatusSelectProps) {
  // Keep the full label on one line; the surrounding table handles overflow on small screens.
  if (readOnly) return <span className="inline-flex shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold" style={getResponseStatusBadgeStyle(status)}>{status}</span>;

  return (
    <span className="relative inline-flex shrink-0" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      <select
        aria-label={label}
        aria-busy={disabled}
        disabled={disabled}
        value={status}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 cursor-pointer appearance-none whitespace-nowrap rounded-full border pl-2.5 pr-7 text-[11px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
        style={{ ...getResponseStatusBadgeStyle(status), width: `${Math.max(13, status.length + 6)}ch` }}
      >
        {Array.from(new Set([status, ...options])).map((option) => <option key={option} value={option} className="bg-background text-foreground">{option}</option>)}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2" />
    </span>
  );
}
