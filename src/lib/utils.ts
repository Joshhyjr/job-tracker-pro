import { clsx, type ClassValue } from "clsx";
import { format, isValid, parseISO } from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDisplayDate(value?: string | null): string {
  if (!value) return "—";
  const parsed = parseISO(value);
  if (!isValid(parsed)) return "—";
  return format(parsed, "MMM d, yyyy");
}
