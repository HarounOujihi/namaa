"use client";

import Link from "next/link";
import {
  ArrowRightIcon,
  CircleCheckIcon,
  ClockIcon,
  RotateCcwIcon,
  StarIcon,
} from "lucide-react";
import type { ComponentType } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getChildSummary } from "@/lib/api";
import { formatNumber, initialsOf } from "@/lib/format";
import type { Child } from "@/lib/types";
import { useQuery } from "@/lib/use-query";

function Metric({
  icon: Icon,
  value,
  unit,
  line,
  iconClassName,
}: {
  icon: ComponentType<{ className?: string }>;
  value: string;
  unit: string;
  line: string;
  iconClassName: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className={`mt-0.5 size-4 shrink-0 ${iconClassName}`} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-lg leading-tight font-semibold tabular-nums">
          {value}
          <span className="ms-1 text-sm font-normal text-muted-foreground">{unit}</span>
        </p>
        <p className="text-sm leading-snug text-muted-foreground">{line}</p>
      </div>
    </div>
  );
}

export function ChildSummaryCard({ child }: { child: Child }) {
  const locale = useLocale();
  const t = useTranslations("dashboard");
  const tErrors = useTranslations("errors");
  const summary = useQuery(() => getChildSummary(child.id), [child.id]);

  return (
    <Link
      href={`/child?id=${child.id}`}
      className="group/card block h-full rounded-xl focus-visible:outline-none"
    >
      <Card className="h-full transition-shadow group-hover/card:shadow-md group-focus-visible/card:ring-3 group-focus-visible/card:ring-ring/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Avatar size="lg">
              {child.avatarUrl ? (
                <AvatarImage src={child.avatarUrl} alt={child.fullName} />
              ) : null}
              <AvatarFallback>{initialsOf(child.fullName)}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col items-start gap-1">
              <CardTitle className="truncate">{child.fullName}</CardTitle>
              {child.gradeLevel ? (
                <Badge variant="secondary">{child.gradeLevel}</Badge>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t("weeklyTitle")}
          </p>
          {summary.loading ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ) : summary.error !== null ? (
            <div className="flex flex-col items-start gap-2">
              <p className="text-sm text-destructive" role="alert">
                {t("summaryError")}
              </p>
              <Button
                variant="ghost"
                size="xs"
                onClick={(event) => {
                  event.preventDefault();
                  summary.reload();
                }}
              >
                <RotateCcwIcon />
                {tErrors("retry")}
              </Button>
            </div>
          ) : summary.data ? (
            <div className="flex flex-col gap-4">
              <Metric
                icon={ClockIcon}
                iconClassName="text-sky-600"
                value={formatNumber(summary.data.thisWeek.minutesSpent, locale)}
                unit={t("minutes")}
                line={t("minutesLine", {
                  minutes: formatNumber(summary.data.thisWeek.minutesSpent, locale),
                })}
              />
              <Metric
                icon={CircleCheckIcon}
                iconClassName="text-emerald-600"
                value={formatNumber(summary.data.thisWeek.activitiesCompleted, locale)}
                unit={t("activities")}
                line={t("activitiesLine", {
                  count: formatNumber(summary.data.thisWeek.activitiesCompleted, locale),
                })}
              />
              <Metric
                icon={StarIcon}
                iconClassName="text-amber-500"
                value={formatNumber(summary.data.thisWeek.starsEarned, locale)}
                unit={t("stars")}
                line={t("starsLine", {
                  count: formatNumber(summary.data.thisWeek.starsEarned, locale),
                })}
              />
            </div>
          ) : null}
        </CardContent>
        <CardFooter>
          <span className="flex items-center gap-1.5 text-sm font-medium text-primary">
            {t("viewChild")}
            <ArrowRightIcon className="size-4 transition-transform group-hover/card:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover/card:-translate-x-0.5" />
          </span>
        </CardFooter>
      </Card>
    </Link>
  );
}
