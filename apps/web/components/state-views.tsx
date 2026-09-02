"use client";


import { CircleAlertIcon, InboxIcon, RotateCcwIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Error block with a retry action for failed data views. */
export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  const t = useTranslations("errors");
  return (
    <Card className={cn("border-destructive/30", className)} role="alert">
      <CardContent className="flex items-center gap-3">
        <CircleAlertIcon className="size-5 shrink-0 text-destructive" />
        <p className="flex-1 text-sm text-muted-foreground">{message}</p>
        {onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCcwIcon />
            {t("retry")}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Empty-data block with a title and an optional hint. */
export function EmptyState({
  title,
  hint,
  className,
}: {
  title: string;
  hint?: string;
  className?: string;
}) {
  return (
    <Card className={cn("border-dashed", className)}>
      <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
        <span className="flex size-10 items-center justify-center rounded-full bg-muted">
          <InboxIcon className="size-5 text-muted-foreground" />
        </span>
        <p className="font-medium">{title}</p>
        {hint ? <p className="max-w-sm text-sm text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

/** Placeholder grid card shown while a child card loads. */
export function CardSkeleton() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-2/3" />
      </CardContent>
    </Card>
  );
}
