"use client";

import { useMemo, type Key } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { useLocale, useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { ErrorState } from "@/components/state-views";
import { getChildProgressCurve } from "@/lib/api";
import { formatDate, formatNumber, useApiErrorMessage } from "@/lib/format";
import type { ProgressPoint, SkillCurve } from "@/lib/types";
import { useQuery } from "@/lib/use-query";

/** Distinct hues for up to nine skill lines, readable on light and dark. */
const PALETTE = [
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#6366f1",
  "#64748b",
];

/**
 * Merges every skill timeline onto one shared date axis, carrying each skill's
 * last known level forward so the lines read as honest steps between events.
 * Each row also carries `__hit_<code>` flags marking real recorded points.
 */
function buildRows(
  skills: SkillCurve[],
): Array<Record<string, number | string | boolean | null>> {
  const dates = [
    ...new Set(skills.flatMap((skill) => skill.points.map((point) => point.date))),
  ].sort((a, b) => a.localeCompare(b));
  return dates.map((date) => {
    const row: Record<string, number | string | boolean | null> = { date };
    for (const skill of skills) {
      const sorted: ProgressPoint[] = [...skill.points].sort((a, b) =>
        a.date.localeCompare(b.date),
      );
      let current: number | null = null;
      let hit = false;
      for (const point of sorted) {
        if (point.date.localeCompare(date) > 0) {
          break;
        }
        current = point.level;
        hit = point.date === date;
      }
      row[skill.code] = current;
      row[`__hit_${skill.code}`] = hit;
    }
    return row;
  });
}

function dotRenderer(code: string) {
  return (props: {
    key?: Key | null;
    cx?: number | null;
    cy?: number | null;
    stroke?: string;
    payload?: Record<string, number | string | boolean | null>;
  }) => {
    if (props.payload?.[`__hit_${code}`] !== true) {
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

export function ProgressCurveCard({ childId }: { childId: string }) {
  const locale = useLocale();
  const t = useTranslations("child.curve");
  const apiErrorMessage = useApiErrorMessage();
  const query = useQuery(() => getChildProgressCurve(childId), [childId]);

  const skills = query.data?.skills ?? [];
  const rows = useMemo(() => (skills.length > 0 ? buildRows(skills) : []), [skills]);
  const config = useMemo<ChartConfig>(
    () =>
      Object.fromEntries(
        skills.map((skill, index) => [
          skill.code,
          { label: skill.name, color: PALETTE[index % PALETTE.length] },
        ]),
      ),
    [skills],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {query.loading ? (
          <Skeleton className="h-72 w-full" />
        ) : query.error !== null ? (
          <ErrorState message={apiErrorMessage(query.error)} onRetry={query.reload} />
        ) : skills.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ChartContainer config={config} className="h-72 w-full">
            <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                reversed={locale === "ar"}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                tickFormatter={(value: string) => formatDate(value, locale, "short")}
              />
              <YAxis
                domain={[1, 10]}
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
                  key={skill.code}
                  dataKey={skill.code}
                  type="linear"
                  stroke={`var(--color-${skill.code})`}
                  strokeWidth={2}
                  connectNulls={false}
                  isAnimationActive={false}
                  dot={dotRenderer(skill.code)}
                />
              ))}
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
