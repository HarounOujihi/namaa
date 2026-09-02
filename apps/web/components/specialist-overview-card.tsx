"use client";

import Link from "next/link";
import {
  ArrowRightIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  ClockIcon,
  ListChecksIcon,
  TargetIcon,
} from "lucide-react";
import type { ComponentType } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate, formatNumber, formatPercent, initialsOf } from "@/lib/format";
import type { ChildStatusReason, SpecialistOverviewRow } from "@/lib/types";
import { cn } from "@/lib/utils";

const REASON_KEYS: Record<ChildStatusReason, string> = {
  not_started: "reasonNotStarted",
  inactive: "reasonInactive",
  struggling: "reasonStruggling",
};

function StatusBadge({ row }: { row: SpecialistOverviewRow }) {
  const t = useTranslations("dashboard");
  if (!row.needsAttention) {
    return (
      <Badge className="border-transparent bg-emerald-600/10 text-emerald-700 dark:text-emerald-400">
        <CircleCheckIcon />
        {t("statusProgressing")}
      </Badge>
    );
  }
  return (
    <Badge className="border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400">
      <CircleAlertIcon />
      {row.statusReason !== null ? t(REASON_KEYS[row.statusReason]) : t("statusAttention")}
    </Badge>
  );
}

function Metric({
  icon: Icon,
  line,
  value,
  iconClassName,
}: {
  icon: ComponentType<{ className?: string }>;
  line: string;
  value: string;
  iconClassName: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className={cn("mt-0.5 size-4 shrink-0", iconClassName)} />
      <div className="flex min-w-0 flex-col">
        <span className="text-sm font-medium tabular-nums">{value}</span>
        <span className="text-xs text-muted-foreground">{line}</span>
      </div>
    </div>
  );
}

export function SpecialistOverviewCard({ row }: { row: SpecialistOverviewRow }) {
  const locale = useLocale();
  const t = useTranslations("dashboard");
  const tSkills = useTranslations("child.skills");

  return (
    <Link
      href={`/child?id=${row.childId}`}
      className="group/card block h-full rounded-xl focus-visible:outline-none"
    >
      <Card className="h-full transition-shadow group-hover/card:shadow-md group-focus-visible/card:ring-3 group-focus-visible/card:ring-ring/50">
        <CardHeader>
          <div className="flex items-start gap-3">
            <Avatar size="lg">
              <AvatarFallback>{initialsOf(row.fullName)}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col items-start gap-1.5">
              <CardTitle className="truncate">{row.fullName}</CardTitle>
              <div className="flex flex-wrap items-center gap-1.5">
                {row.gradeLevel ? <Badge variant="secondary">{row.gradeLevel}</Badge> : null}
                <StatusBadge row={row} />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-3">
          <Metric
            icon={ClockIcon}
            iconClassName="text-sky-600"
            value={
              row.lastActivityAt !== null
                ? formatDate(row.lastActivityAt, locale, "medium")
                : t("noActivityYet")
            }
            line={t("lastActivity")}
          />
          <Metric
            icon={ListChecksIcon}
            iconClassName="text-violet-600"
            value={formatNumber(row.totalAttempts, locale)}
            line={tSkills("attempts")}
          />
          <Metric
            icon={TargetIcon}
            iconClassName="text-emerald-600"
            value={
              row.recentSuccessRate === null
                ? "—"
                : formatPercent(row.recentSuccessRate, locale)
            }
            line={tSkills("successRate")}
          />
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
