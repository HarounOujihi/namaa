import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Single source of truth for status chip colors across the CMS.
 */
const STATUS_CLASS: Record<string, string> = {
  DRAFT: "border-transparent bg-muted text-muted-foreground",
  REVIEW: "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-400",
  PUBLISHED: "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  ARCHIVED: "border-transparent bg-muted/60 text-muted-foreground/70",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const label = status.length === 0 ? "—" : status.charAt(0) + status.slice(1).toLowerCase();
  return (
    <Badge variant="outline" className={cn(STATUS_CLASS[status] ?? "text-muted-foreground", className)}>
      {label}
    </Badge>
  );
}
