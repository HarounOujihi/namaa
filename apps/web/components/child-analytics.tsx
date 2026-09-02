"use client";

import { useMemo, type Key } from "react";
import { TriangleAlertIcon } from "lucide-react";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ErrorState } from "@/components/state-views";
import { SKILL_PALETTE } from "@/components/progress-curve-card";
import { getChildAnalytics } from "@/lib/api";
import {
  formatDate,
  formatDuration,
  formatNumber,
  formatPercent,
  useApiErrorMessage,
} from "@/lib/format";
import type {
  BaselineComparisonRow,
  DifficultLetter,
  ReadingMetrics,
  SkillMinutes,
  SkillWeeklyLevels,
  SpellingErrors,
  StagnationAlert,
} from "@/lib/types";
import { useQuery } from "@/lib/use-query";

/** Locale-aware dash for metrics that have no value yet. */
const NO_VALUE = "—";

/**
 * Merges every skill's weekly series onto one shared week axis, carrying each
 * skill's last known level forward so a missing week reads as "unchanged",
 * and weeks before the skill's first assessment stay empty (line starts later).
 */
function buildWeeklyRows(
  skills: SkillWeeklyLevels[],
): Array<Record<string, number | string | null>> {
  const weekStarts = [
    ...new Set(skills.flatMap((skill) => skill.weeks.map((week) => week.weekStart))),
  ].sort((a, b) => a.localeCompare(b));
  const levelByWeek = skills.map((skill) =>
    Object.fromEntries(skill.weeks.map((week) => [week.weekStart, week.level])),
  );
  const carried: Array<number | null> = skills.map(() => null);
  return weekStarts.map((weekStart) => {
    const row: Record<string, number | string | null> = { weekStart };
    skills.forEach((skill, index) => {
      const level = levelByWeek[index][weekStart];
      if (level !== undefined) {
        carried[index] = level;
      }
      row[skill.skillCode] = carried[index];
    });
    return row;
  });
}

function skillChartConfig(
  entries: Array<{ skillCode: string; name: string }>,
): ChartConfig {
  return Object.fromEntries(
    entries.map((skill, index) => [
      skill.skillCode,
      { label: skill.name, color: SKILL_PALETTE[index % SKILL_PALETTE.length] },
    ]),
  );
}

/** Marks each line's final week — the child's current level — as a dot. */
function lastWeekDot(weekStart: string) {
  return (props: {
    key?: Key | null;
    cx?: number | null;
    cy?: number | null;
    stroke?: string;
    payload?: Record<string, number | string | null>;
  }) => {
    if (props.payload?.weekStart !== weekStart) {
      return <g key={props.key ?? undefined} />;
    }
    return (
      <circle
        key={props.key ?? undefined}
        cx={props.cx ?? undefined}
        cy={props.cy ?? undefined}
        r={3.5}
        fill={props.stroke ?? "currentColor"}
        stroke="var(--background)"
        strokeWidth={1.5}
      />
    );
  };
}

function percentLabel(locale: string) {
  const RADIAN = Math.PI / 180;
  return (props: {
    cx?: number;
    cy?: number;
    midAngle?: number;
    innerRadius?: number;
    outerRadius?: number;
    percent?: number;
  }) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
    if (
      cx === undefined ||
      cy === undefined ||
      midAngle === undefined ||
      innerRadius === undefined ||
      outerRadius === undefined ||
      percent === undefined ||
      // Thin slices cannot host a readable label; the tooltip covers them.
      percent < 0.05
    ) {
      return null;
    }
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    return (
      <text
        x={cx + radius * Math.cos(-midAngle * RADIAN)}
        y={cy + radius * Math.sin(-midAngle * RADIAN)}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-background text-[11px] font-medium"
      >
        {formatPercent(percent, locale)}
      </text>
    );
  };
}

function WeeklyLevelsCard({ skills }: { skills: SkillWeeklyLevels[] }) {
  const locale = useLocale();
  const t = useTranslations("child.analytics.weeklyLevels");
  const rows = useMemo(
    () => (skills.length > 0 ? buildWeeklyRows(skills) : []),
    [skills],
  );
  const config = useMemo(() => skillChartConfig(skills), [skills]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {skills.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ChartContainer config={config} className="h-72 w-full">
            <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="weekStart"
                reversed={locale === "ar"}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                tickFormatter={(value: string) => formatDate(value, locale, "short")}
              />
              <YAxis
                domain={[0, "auto"]}
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={28}
                tickFormatter={(value: number) => formatNumber(value, locale)}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(label) => formatDate(String(label), locale, "medium")}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              {skills.map((skill) => (
                <Line
                  key={skill.skillCode}
                  dataKey={skill.skillCode}
                  type="stepAfter"
                  stroke={`var(--color-${skill.skillCode})`}
                  strokeWidth={2}
                  dot={lastWeekDot(skill.weeks[skill.weeks.length - 1]?.weekStart ?? "")}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function TimeDistributionCard({ distribution }: { distribution: SkillMinutes[] }) {
  const locale = useLocale();
  const t = useTranslations("child.analytics.time");
  const config = useMemo(() => skillChartConfig(distribution), [distribution]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {distribution.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ChartContainer config={config} className="mx-auto aspect-square max-h-64 w-full">
            <PieChart>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(value, name) => [
                      `${formatNumber(Number(value), locale)} ${t("minutesUnit")}`,
                      config[String(name)]?.label ?? String(name),
                    ]}
                  />
                }
              />
              <Pie
                data={distribution}
                dataKey="minutes"
                nameKey="skillCode"
                innerRadius="55%"
                outerRadius="85%"
                paddingAngle={2}
                stroke="var(--background)"
                strokeWidth={2}
                label={percentLabel(locale)}
                labelLine={false}
                isAnimationActive={false}
              >
                {distribution.map((skill) => (
                  <Cell key={skill.skillCode} fill={`var(--color-${skill.skillCode})`} />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="skillCode" />} />
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

/** Change chip: growth is green-tinted, no change muted, decline amber — never harsh red. */
function DeltaChip({ delta, locale }: { delta: number | null; locale: string }) {
  const t = useTranslations("child.analytics.baseline");
  if (delta === null) {
    return <span className="text-muted-foreground">{NO_VALUE}</span>;
  }
  if (delta === 0) {
    return (
      <Badge variant="secondary" className="tabular-nums">
        {formatNumber(0, locale)}
      </Badge>
    );
  }
  const improved = delta > 0;
  const sign = improved ? "+" : "−";
  return (
    <Badge
      className={
        improved
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
      }
    >
      <span className="tabular-nums">
        {sign}
        {formatNumber(Math.abs(delta), locale)}
      </span>
      <span className="sr-only">{improved ? t("improved") : t("declined")}</span>
    </Badge>
  );
}

function BaselineCard({ rows }: { rows: BaselineComparisonRow[] }) {
  const locale = useLocale();
  const t = useTranslations("child.analytics.baseline");

  const levelCell = (level: number | null) =>
    level === null ? (
      <span className="text-muted-foreground">{NO_VALUE}</span>
    ) : (
      formatNumber(level, locale)
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("skill")}</TableHead>
              <TableHead className="text-end">{t("baseline")}</TableHead>
              <TableHead className="text-end">{t("current")}</TableHead>
              <TableHead className="text-end">{t("delta")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.skillCode}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="text-end tabular-nums">
                  {levelCell(row.baselineLevel)}
                </TableCell>
                <TableCell className="text-end font-medium tabular-nums">
                  {levelCell(row.currentLevel)}
                </TableCell>
                <TableCell className="text-end">
                  <DeltaChip delta={row.delta} locale={locale} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function DifficultLettersCard({ letters }: { letters: DifficultLetter[] }) {
  const locale = useLocale();
  const t = useTranslations("child.analytics.letters");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {letters.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {letters.map((letter) => (
              <Badge
                key={letter.letter}
                variant="outline"
                className="gap-1.5 border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-amber-700 dark:text-amber-400"
              >
                <span className="font-heading text-sm">{letter.letter}</span>
                <span className="tabular-nums">
                  {t("times", { count: formatNumber(letter.timesChosenWrong, locale) })}
                </span>
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** One labelled metric line, keeping nulls readable. */
function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function ReadingCard({ metrics }: { metrics: ReadingMetrics }) {
  const locale = useLocale();
  const t = useTranslations("child.analytics.reading");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {metrics.attempts === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <>
            <MetricRow label={t("attempts")} value={formatNumber(metrics.attempts, locale)} />
            <MetricRow
              label={t("avgDuration")}
              value={
                metrics.avgDurationMs === null
                  ? NO_VALUE
                  : formatDuration(metrics.avgDurationMs, locale)
              }
            />
            <MetricRow
              label={t("successRate")}
              value={
                metrics.successRate === null
                  ? NO_VALUE
                  : formatPercent(metrics.successRate, locale)
              }
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SpellingCard({ errors }: { errors: SpellingErrors }) {
  const locale = useLocale();
  const t = useTranslations("child.analytics.spelling");
  const missed = errors.byExercise.filter((exercise) => exercise.wrong > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {errors.byExercise.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <>
            <MetricRow
              label={t("totalWrong")}
              value={formatNumber(errors.totalWrong, locale)}
            />
            {missed.length > 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("topExercises")}
                </p>
                {missed.map((exercise) => (
                  <div
                    key={exercise.title}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0 truncate">{exercise.title}</span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">
                      {t("score", {
                        wrong: formatNumber(exercise.wrong, locale),
                        total: formatNumber(exercise.total, locale),
                      })}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StagnationAlerts({ alerts }: { alerts: StagnationAlert[] }) {
  const locale = useLocale();
  const t = useTranslations("child.analytics.stagnation");
  if (alerts.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-3">
      {alerts.map((alert) => (
        <Card
          key={alert.skillCode}
          role="status"
          className="border-amber-500/40 bg-amber-500/10"
        >
          <CardContent className="flex items-start gap-3">
            <TriangleAlertIcon className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-sm leading-6">
              {t("body", {
                skill: alert.name,
                attempts: formatNumber(alert.attempts14d, locale),
                percent: formatPercent(alert.successRate, locale),
              })}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Phase 10 analytics: one fetch, six parent-friendly views. Shown for both
 * PARENT and SPECIALIST roles on the child detail page.
 */
export function ChildAnalyticsSection({ childId }: { childId: string }) {
  const t = useTranslations("child.analytics");
  const apiErrorMessage = useApiErrorMessage();
  const query = useQuery(() => getChildAnalytics(childId), [childId]);

  if (query.loading) {
    return (
      <section className="flex flex-col gap-4">
        <Skeleton className="h-7 w-40" />
        <div className="grid items-start gap-4 lg:grid-cols-3">
          <div className="flex flex-col gap-4 lg:col-span-2">
            <Skeleton className="h-80 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
          <div className="flex flex-col gap-4">
            <Skeleton className="h-72 w-full rounded-xl" />
            <Skeleton className="h-44 w-full rounded-xl" />
            <Skeleton className="h-44 w-full rounded-xl" />
            <Skeleton className="h-36 w-full rounded-xl" />
          </div>
        </div>
      </section>
    );
  }

  if (query.error !== null || query.data === null) {
    return (
      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-xl font-semibold">{t("title")}</h2>
        <ErrorState message={apiErrorMessage(query.error)} onRetry={query.reload} />
      </section>
    );
  }

  const data = query.data;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-xl font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <StagnationAlerts alerts={data.stagnation} />
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <WeeklyLevelsCard skills={data.weeklyLevels} />
          <BaselineCard rows={data.baselineComparison} />
        </div>
        <div className="flex flex-col gap-4">
          <TimeDistributionCard distribution={data.timeDistribution} />
          <ReadingCard metrics={data.readingMetrics} />
          <SpellingCard errors={data.spellingErrors} />
          <DifficultLettersCard letters={data.difficultLetters} />
        </div>
      </div>
    </section>
  );
}
