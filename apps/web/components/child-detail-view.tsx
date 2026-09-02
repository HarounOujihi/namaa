"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  LoaderCircleIcon,
  MailIcon,
  MinusIcon,
  PlusIcon,
  PrinterIcon,
  SparklesIcon,
  TrendingDownIcon,
  TrendingUpIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ErrorState } from "@/components/state-views";
import { ActivityHistoryCard } from "@/components/activity-history-card";
import { PlanCard } from "@/components/plan-card";
import { ChildAnalyticsSection } from "@/components/child-analytics";
import { ProgressCurveCard } from "@/components/progress-curve-card";
import {
  getChildSettings,
  getChildSpecialists,
  getChildSummary,
  listChildren,
  setChildSkillLevel,
  updateChildSettings,
} from "@/lib/api";
import {
  ageInYears,
  formatDate,
  formatNumber,
  formatPercent,
  initialsOf,
  useApiErrorMessage,
} from "@/lib/format";
import type { AuthResponse, ChildSettings, SkillProgressRow, WeeklySummary } from "@/lib/types";
import { useQuery, type QueryState } from "@/lib/use-query";

/** Visual ceiling for the level progress bar (levels can exceed it on paper). */
const MAX_SKILL_LEVEL = 3;

function Trend({ current, previous }: { current: number; previous: number }) {
  const t = useTranslations("child.comparison");
  if (current > previous) {
    return (
      <span className="inline-flex items-center text-emerald-600">
        <TrendingUpIcon className="size-4" />
        <span className="sr-only">{t("up")}</span>
      </span>
    );
  }
  if (current < previous) {
    return (
      <span className="inline-flex items-center text-destructive">
        <TrendingDownIcon className="size-4" />
        <span className="sr-only">{t("down")}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-muted-foreground">
      <MinusIcon className="size-4" />
      <span className="sr-only">{t("same")}</span>
    </span>
  );
}

function SkillsCard({
  summary,
  childId,
  canEditLevel,
}: {
  summary: QueryState<WeeklySummary>;
  childId: string;
  canEditLevel: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("child.skills");
  const apiErrorMessage = useApiErrorMessage();
  // Optimistic per-skill level overrides applied on top of the loaded summary.
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function adjustLevel(skill: SkillProgressRow, delta: number): Promise<void> {
    const displayed = overrides[skill.skillId] ?? skill.level;
    const next = Math.min(10, Math.max(1, (displayed ?? 0) + delta));
    if (displayed !== null && next === displayed) {
      return;
    }
    setOverrides((prev) => ({ ...prev, [skill.skillId]: next }));
    setPendingId(skill.skillId);
    try {
      await setChildSkillLevel(childId, skill.skillId, next);
      toast.success(
        t("levelSaved", { skill: skill.name, level: formatNumber(next, locale) }),
      );
    } catch (err) {
      setOverrides((prev) => {
        const reverted = { ...prev };
        if (skill.level === null) {
          delete reverted[skill.skillId];
        } else {
          reverted[skill.skillId] = skill.level;
        }
        return reverted;
      });
      toast.error(apiErrorMessage(err));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {summary.loading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : summary.error !== null ? (
          <ErrorState message={apiErrorMessage(summary.error)} onRetry={summary.reload} />
        ) : (summary.data?.skills.length ?? 0) === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("skill")}</TableHead>
                <TableHead>{t("level")}</TableHead>
                <TableHead className="text-end">{t("attempts")}</TableHead>
                <TableHead className="text-end">{t("successRate")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.data?.skills.map((skill) => {
                const displayed = overrides[skill.skillId] ?? skill.level;
                const pending = pendingId === skill.skillId;
                return (
                  <TableRow key={skill.code}>
                    <TableCell className="font-medium">{skill.name}</TableCell>
                    <TableCell>
                      {displayed === null && !canEditLevel ? (
                        <span className="text-sm text-muted-foreground">
                          {t("notStarted")}
                        </span>
                      ) : (
                        <div className="flex w-52 flex-col gap-1.5">
                          <div
                            className="flex items-center gap-2"
                            role={canEditLevel ? "group" : undefined}
                            aria-label={
                              canEditLevel
                                ? t("adjustLevel", { skill: skill.name })
                                : undefined
                            }
                          >
                            {canEditLevel ? (
                              <>
                                <Button
                                  variant="outline"
                                  size="icon-xs"
                                  disabled={pending || (displayed !== null && displayed <= 1)}
                                  onClick={() => void adjustLevel(skill, -1)}
                                >
                                  {pending ? (
                                    <LoaderCircleIcon className="animate-spin" />
                                  ) : (
                                    <MinusIcon />
                                  )}
                                  <span className="sr-only">−</span>
                                </Button>
                                <span className="w-7 text-center text-sm font-medium tabular-nums">
                                  {displayed === null ? "—" : formatNumber(displayed, locale)}
                                </span>
                                <Button
                                  variant="outline"
                                  size="icon-xs"
                                  disabled={pending || (displayed !== null && displayed >= 10)}
                                  onClick={() => void adjustLevel(skill, 1)}
                                >
                                  <PlusIcon />
                                  <span className="sr-only">+</span>
                                </Button>
                              </>
                            ) : null}
                            <span className="text-xs text-muted-foreground">
                              {displayed === null
                                ? t("notStarted")
                                : t("levelValue", {
                                    level: formatNumber(displayed, locale),
                                  })}
                            </span>
                          </div>
                          {displayed !== null ? (
                            <Progress
                              value={
                                (Math.min(displayed, MAX_SKILL_LEVEL) / MAX_SKILL_LEVEL) * 100
                              }
                            />
                          ) : null}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {formatNumber(skill.attempts, locale)}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {skill.successRate === null
                        ? "—"
                        : formatPercent(skill.successRate, locale)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function ComparisonCard({ summary }: { summary: QueryState<WeeklySummary> }) {
  const locale = useLocale();
  const t = useTranslations("child.comparison");
  const tDashboard = useTranslations("dashboard");
  const tTotals = useTranslations("child.totals");
  const apiErrorMessage = useApiErrorMessage();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        {summary.data ? (
          <CardDescription>
            {tDashboard("weekOf", { weekOf: formatDate(summary.data.weekOf, locale, "long") })}
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {summary.loading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : summary.error !== null ? (
          <ErrorState message={apiErrorMessage(summary.error)} onRetry={summary.reload} />
        ) : summary.data ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("metric")}</TableHead>
                  <TableHead className="text-end">{t("lastWeek")}</TableHead>
                  <TableHead className="text-end">{t("thisWeek")}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">{t("minutes")}</TableCell>
                  <TableCell className="text-end tabular-nums">
                    {formatNumber(summary.data.lastWeek.minutesSpent, locale)}
                  </TableCell>
                  <TableCell className="text-end font-medium tabular-nums">
                    {formatNumber(summary.data.thisWeek.minutesSpent, locale)}
                  </TableCell>
                  <TableCell>
                    <Trend
                      current={summary.data.thisWeek.minutesSpent}
                      previous={summary.data.lastWeek.minutesSpent}
                    />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">{t("activities")}</TableCell>
                  <TableCell className="text-end tabular-nums">
                    {formatNumber(summary.data.lastWeek.activitiesCompleted, locale)}
                  </TableCell>
                  <TableCell className="text-end font-medium tabular-nums">
                    {formatNumber(summary.data.thisWeek.activitiesCompleted, locale)}
                  </TableCell>
                  <TableCell>
                    <Trend
                      current={summary.data.thisWeek.activitiesCompleted}
                      previous={summary.data.lastWeek.activitiesCompleted}
                    />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <p className="text-sm text-muted-foreground">
              {tTotals("lifetimeAttempts", {
                count: formatNumber(summary.data.totals.lifetimeAttempts, locale),
              })}
            </p>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MostImprovedCard({ summary }: { summary: QueryState<WeeklySummary> }) {
  const locale = useLocale();
  const t = useTranslations("child.mostImproved");
  const apiErrorMessage = useApiErrorMessage();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SparklesIcon className="size-4 text-emerald-600" />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {summary.loading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : summary.error !== null ? (
          <p className="text-sm text-muted-foreground" role="alert">
            {apiErrorMessage(summary.error)}
          </p>
        ) : summary.data?.mostImprovedSkill ? (
          <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            {t("body", {
              skill: summary.data.mostImprovedSkill.name,
              percent: formatNumber(Math.round(summary.data.mostImprovedSkill.delta * 100), locale),
            })}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">{t("none")}</p>
        )}
      </CardContent>
    </Card>
  );
}

function SettingsCard({
  childId,
  query,
}: {
  childId: string;
  query: QueryState<ChildSettings>;
}) {
  const t = useTranslations("settings");
  const apiErrorMessage = useApiErrorMessage();
  const [dailyLimit, setDailyLimit] = useState("");
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState("");
  const [pending, setPending] = useState(false);
  const seededRef = useRef(false);

  useEffect(() => {
    if (query.data !== null && !seededRef.current) {
      seededRef.current = true;
      setDailyLimit(
        query.data.dailyLimitMinutes === null ? "" : String(query.data.dailyLimitMinutes),
      );
      setReminderEnabled(query.data.reminderEnabled);
      setReminderTime(query.data.reminderTime ?? "");
    }
  }, [query.data]);

  async function handleSave(): Promise<void> {
    if (pending) {
      return;
    }
    const trimmed = dailyLimit.trim();
    const limit = trimmed === "" ? null : Number(trimmed);
    if (limit !== null && (!Number.isInteger(limit) || limit < 5 || limit > 480)) {
      toast.error(t("dailyLimitHint"));
      return;
    }
    setPending(true);
    try {
      await updateChildSettings(childId, {
        dailyLimitMinutes: limit,
        reminderEnabled,
        reminderTime: reminderEnabled && reminderTime !== "" ? reminderTime : null,
      });
      toast.success(t("saved"));
      query.reload();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {query.loading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : query.error !== null ? (
          <ErrorState message={apiErrorMessage(query.error)} onRetry={query.reload} />
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="settings-daily-limit">{t("dailyLimit")}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="settings-daily-limit"
                  type="number"
                  dir="ltr"
                  min={5}
                  max={480}
                  placeholder="—"
                  value={dailyLimit}
                  onChange={(event) => setDailyLimit(event.target.value)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">{t("dailyLimitUnit")}</span>
              </div>
              <p className="text-xs text-muted-foreground">{t("dailyLimitHint")}</p>
            </div>
            <Separator />
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="settings-reminder">{t("reminder")}</Label>
                <Switch
                  id="settings-reminder"
                  checked={reminderEnabled}
                  onCheckedChange={setReminderEnabled}
                />
              </div>
              <p className="text-xs text-muted-foreground">{t("reminderHint")}</p>
              <div className="flex items-center gap-2 pt-1">
                <Label htmlFor="settings-reminder-time" className="shrink-0">
                  {t("reminderTime")}
                </Label>
                <Input
                  id="settings-reminder-time"
                  type="time"
                  dir="ltr"
                  value={reminderTime}
                  onChange={(event) => setReminderTime(event.target.value)}
                  disabled={!reminderEnabled}
                  className="w-28"
                />
              </div>
            </div>
            <Button onClick={() => void handleSave()} disabled={pending}>
              {pending ? <LoaderCircleIcon className="animate-spin" /> : null}
              {pending ? t("saving") : t("save")}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SpecialistsCard({ childId }: { childId: string }) {
  const t = useTranslations("child.specialists");
  const locale = useLocale();
  const apiErrorMessage = useApiErrorMessage();
  const specialists = useQuery(() => getChildSpecialists(childId), [childId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {specialists.loading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : specialists.error !== null ? (
          <ErrorState message={apiErrorMessage(specialists.error)} onRetry={specialists.reload} />
        ) : (specialists.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {specialists.data?.map((specialist) => (
              <li key={specialist.email} className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <MailIcon className="size-4 text-muted-foreground" />
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-medium">{specialist.fullName}</span>
                  <a
                    href={`mailto:${specialist.email}`}
                    dir="ltr"
                    className="truncate text-sm text-primary underline-offset-4 hover:underline"
                  >
                    {specialist.email}
                  </a>
                  <span className="text-xs text-muted-foreground">
                    {t("since", { since: formatDate(specialist.since, locale, "medium") })}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function MissingChild({ title, hint, back }: { title: string; hint: string; back: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="font-medium">{title}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>
        <Link
          href="/"
          className={buttonVariants({ variant: "outline", size: "sm", className: "self-start" })}
        >
          <ArrowRightIcon className="rtl:-scale-x-100" />
          {back}
        </Link>
      </CardContent>
    </Card>
  );
}

export function ChildDetailView({ childId, auth }: { childId: string; auth: AuthResponse }) {
  const locale = useLocale();
  const t = useTranslations("child");
  const apiErrorMessage = useApiErrorMessage();
  const isParent = auth.user.role === "PARENT";
  const childrenQuery = useQuery(() => listChildren(), []);
  const summaryQuery = useQuery(() => getChildSummary(childId), [childId], {
    enabled: childId !== "",
  });
  const settingsQuery = useQuery(() => getChildSettings(childId), [childId], {
    enabled: isParent && childId !== "",
  });

  const child = childrenQuery.data?.find((candidate) => candidate.id === childId) ?? null;

  if (childId === "") {
    return <MissingChild title={t("missingTitle")} hint={t("missingHint")} back={t("backHome")} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/" className={buttonVariants({ variant: "ghost", size: "sm", className: "self-start" })}>
        <ArrowRightIcon className="rtl:-scale-x-100" />
        {t("back")}
      </Link>

      {childrenQuery.loading ? (
        <Skeleton className="h-24 w-full rounded-xl" />
      ) : childrenQuery.error !== null ? (
        <ErrorState
          message={apiErrorMessage(childrenQuery.error)}
          onRetry={childrenQuery.reload}
        />
      ) : child === null ? (
        <MissingChild title={t("notFoundTitle")} hint={t("notFoundHint")} back={t("backHome")} />
      ) : (
        <>
          <Card>
            <CardContent className="flex items-center gap-4">
              <Avatar size="lg">
                {child.avatarUrl ? (
                  <AvatarImage src={child.avatarUrl} alt={child.fullName} />
                ) : null}
                <AvatarFallback>{initialsOf(child.fullName)}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <h1 className="font-heading truncate text-2xl font-semibold">{child.fullName}</h1>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {child.gradeLevel ? (
                    <Badge variant="secondary">{t("grade", { grade: child.gradeLevel })}</Badge>
                  ) : null}
                  <span className="text-sm text-muted-foreground">
                    {t("age", {
                      years: ageInYears(child.birthDate),
                      yearsText: formatNumber(ageInYears(child.birthDate), locale),
                    })}
                  </span>
                </div>
              </div>
              <Link
                href={`/child/report?id=${childId}`}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline", size: "sm", className: "shrink-0 self-start" })}
              >
                <PrinterIcon />
                {t("report")}
              </Link>
            </CardContent>
          </Card>

          <div className="grid items-start gap-4 lg:grid-cols-3">
            <div className="flex flex-col gap-4 lg:col-span-2">
              <SkillsCard summary={summaryQuery} childId={childId} canEditLevel={!isParent} />
              <ProgressCurveCard childId={childId} />
              <ActivityHistoryCard childId={childId} />
              <ComparisonCard summary={summaryQuery} />
            </div>
            <div className="flex flex-col gap-4">
              <MostImprovedCard summary={summaryQuery} />
              {isParent ? (
                <SettingsCard childId={childId} query={settingsQuery} />
              ) : (
                <PlanCard childId={childId} />
              )}
              <SpecialistsCard childId={childId} />
            </div>
          </div>

          <ChildAnalyticsSection childId={childId} />
        </>
      )}
    </div>
  );
}
