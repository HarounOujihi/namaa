"use client";

import { CheckIcon, StarIcon, XIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ErrorState } from "@/components/state-views";
import { getChildActivities } from "@/lib/api";
import { formatDate, formatDuration, formatNumber, useApiErrorMessage } from "@/lib/format";
import type { ActivityRow } from "@/lib/types";
import { useQuery } from "@/lib/use-query";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function ResultBadge({ correct, label }: { correct: boolean; label: string }) {
  return (
    <Badge
      className={cn(
        "border-transparent",
        correct
          ? "bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
          : "bg-muted text-muted-foreground",
      )}
    >
      {correct ? <CheckIcon /> : <XIcon />}
      {label}
    </Badge>
  );
}

function StarsCell({ stars, locale }: { stars: number | null; locale: string }) {
  if (stars === null) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      <StarIcon className="size-3.5 fill-amber-400 text-amber-400" />
      {formatNumber(stars, locale)}
    </span>
  );
}

export function ActivityHistoryCard({ childId }: { childId: string }) {
  const locale = useLocale();
  const t = useTranslations("child.history");
  const apiErrorMessage = useApiErrorMessage();
  const query = useQuery(() => getChildActivities(childId), [childId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {query.loading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : query.error !== null ? (
          <ErrorState message={apiErrorMessage(query.error)} onRetry={query.reload} />
        ) : (query.data?.length ?? 0) === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("exercise")}</TableHead>
                <TableHead>{t("skill")}</TableHead>
                <TableHead>{t("result")}</TableHead>
                <TableHead className="text-end">{t("stars")}</TableHead>
                <TableHead className="text-end">{t("duration")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data?.map((row: ActivityRow) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(row.date, locale, "medium")}
                  </TableCell>
                  <TableCell
                    className="max-w-56 truncate font-medium"
                    title={t("attemptOf", {
                      number: formatNumber(row.attemptNumber, locale),
                    })}
                  >
                    {row.exerciseTitle}
                  </TableCell>
                  <TableCell className="max-w-40 truncate text-muted-foreground">
                    {row.skill}
                  </TableCell>
                  <TableCell>
                    <ResultBadge
                      correct={row.correct}
                      label={row.correct ? t("correct") : t("incorrect")}
                    />
                  </TableCell>
                  <TableCell className="text-end">
                    <StarsCell stars={row.stars} locale={locale} />
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {row.durationMs === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      formatDuration(row.durationMs, locale)
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
