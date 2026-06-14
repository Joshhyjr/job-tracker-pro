import type { ReactNode } from "react";

type TableSectionProps = {
  children: ReactNode;
};

export function TableSection({ children }: TableSectionProps) {
  // Keep shared table framing in one component so list-style pages stay visually aligned.
  return <div className="overflow-hidden rounded-2xl border border-border/40">{children}</div>;
}
