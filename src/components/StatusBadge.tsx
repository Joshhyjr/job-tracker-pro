import { Badge } from "@/components/ui/badge";
import { STATUS_BADGE_CLASSES, type CurrentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: CurrentStatus }) {
  return (
    <Badge variant="outline" className={cn("text-xs font-medium", STATUS_BADGE_CLASSES[status])}>
      {status}
    </Badge>
  );
}
