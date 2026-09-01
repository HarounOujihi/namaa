import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { CircleAlertIcon, InboxIcon, RefreshCwIcon } from "lucide-react";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description !== undefined ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children !== undefined && children !== null ? (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center">
      <CircleAlertIcon className="size-6 text-destructive" />
      <div>
        <p className="text-sm font-medium">Could not load data</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{message}</p>
      </div>
      {onRetry !== undefined ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCwIcon />
          Retry
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center">
      <InboxIcon className="size-6 text-muted-foreground" />
      <p className="text-sm font-medium">{title}</p>
      {description !== undefined ? (
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {children !== undefined && children !== null ? <div className="mt-2">{children}</div> : null}
    </div>
  );
}
