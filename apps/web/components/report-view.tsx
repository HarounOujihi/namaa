"use client";

import Link from "next/link";
import { ArrowRightIcon, PrinterIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/state-views";
import { getChildActivities, getChildSummary, listChildren } from "@/lib/api";
import {
  ageInYears,
  formatDate,
  formatDuration,
  formatNumber,
  formatPercent,
  useApiErrorMessage,
} from "@/lib/format";
import { useQuery } from "@/lib/use-query";
import { cn } from "@/lib/utils";

const PRINT_CSS = `
@media print {
  @page { margin: 14mm; }
  body { background: #fff !important; }
  .report-sheet { box-shadow: none !important; border-radius: 0 !important; padding: 0 !important; }
`;

function ReportTable({
  head,
  rows,
}: {
  head: string[];
  rows: Array<Array<string | null>>;
}) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr>
          {head.map((label, index) => (
            <th
              key={label}
              className={cn(
                "border-b border-neutral-300 px-2 py-2 text-start text-xs font-semibold tracking-wide text-neutral-500 uppercase",
                index > 0 && index === head.length - 1 && "text-end",
              )}
            >
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex} className="align-top">
            {row.map((cell, cellIndex) => (
              <td
                key={cellIndex}
                className={cn(
                  "border-b border-neutral-200 px-2 py-2",
                  cellIndex === row.length - 1 && "text-end tabular-nums",
                )}
              >
                {cell ?? "—"}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ReportView({ childId }: { childId: string }) {
  const locale = useLocale();
  const t = useTranslations("report");
  const tChild = useTranslations("child");
  const tSkills = useTranslations("child.skills");
  const tHistory = useTranslations("child.history");
  const tImproved = useTranslations("child.mostImproved");
  const apiErrorMessage = useApiErrorMessage();

  const childrenQuery = useQuery(() => listChildren(), []);
  const summaryQuery = useQuery(() => getChildSummary(childId), [childId], {
    enabled: childId !== "",
  });
  const activitiesQuery = useQuery(() => getChildActivities(childId, 10), [childId], {
    enabled: childId !== "",
  });

  const child = childrenQuery.data?.find((candidate) => candidate.id === childId) ?? null;
  const summary = summaryQuery.data;
  const activities = activitiesQuery.data ?? [];

  if (childId === "") {
    return (
      <main className="mx-auto flex max-w-3xl flex-col items-center gap-3 px-4 py-16 text-center">
        <p className="font-medium">{tChild("missingTitle")}</p>
        <Link href="/" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <ArrowRightIcon className="rtl:-scale-x-100" />
          {tChild("backHome")}
        </Link>
      </main>
    );
  }

  return (
    <div className="min-h-svh bg-neutral-100 print:bg-white">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div className="mx-auto w-full max-w-3xl px-4 py-8 print:max-w-none print:p-0">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <Link
            href={`/child?id=${childId}`}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            <ArrowRightIcon className="rtl:-scale-x-100" />
            {t("backToChild")}
          </Link>
          <Button onClick={() => window.print()}>
            <PrinterIcon />
            {t("print")}
          </Button>
        </div>

        <article className="report-sheet rounded-xl bg-white p-8 text-neutral-900 shadow-sm">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-300 pb-4">
            <div className="flex flex-col gap-1">
              {childrenQuery.loading ? (
                <Skeleton className="h-8 w-48" />
              ) : childrenQuery.error !== null ? (
                <ErrorState
                  message={apiErrorMessage(childrenQuery.error)}
                  onRetry={childrenQuery.reload}
                />
              ) : child === null ? (
                <p className="font-medium">{tChild("notFoundTitle")}</p>
              ) : (
                <>
                  <h1 className="text-2xl font-semibold">{child.fullName}</h1>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-600">
                    {child.gradeLevel ? (
                      <span>{tChild("grade", { grade: child.gradeLevel })}</span>
                    ) : null}
                    <span>
                      {tChild("age", {
                        years: ageInYears(child.birthDate),
                        yearsText: formatNumber(ageInYears(child.birthDate), locale),
                      })}
                    </span>
                  </div>
                </>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="font-heading text-lg font-semibold">{t("title")}</span>
              <span className="text-sm text-neutral-600">
                {t("generatedOn", { date: formatDate(new Date().toISOString(), locale, "long") })}
              </span>
            </div>
          </header>

          <section className="mt-6 flex flex-col gap-3">
            <h2 className="text-base font-semibold">{tSkills("title")}</h2>
            {summaryQuery.loading ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            ) : summaryQuery.error !== null ? (
              <ErrorState
                message={apiErrorMessage(summaryQuery.error)}
                onRetry={summaryQuery.reload}
              />
            ) : (
              <ReportTable
                head={[
                  tSkills("skill"),
                  tSkills("level"),
                  tSkills("attempts"),
                  tSkills("successRate"),
                ]}
                rows={(summary?.skills ?? []).map((skill) => [
                  skill.name,
                  skill.level === null
                    ? tSkills("notStarted")
                    : tSkills("levelValue", {
                        level: formatNumber(skill.level, locale),
                      }),
                  formatNumber(skill.attempts, locale),
                  skill.successRate === null
                    ? null
                    : formatPercent(skill.successRate, locale),
                ])}
              />
            )}
          </section>

          {summary?.mostImprovedSkill ? (
            <section className="mt-6">
              <h2 className="text-base font-semibold">{tImproved("title")}</h2>
              <p className="mt-1 text-sm text-neutral-700">
                {tImproved("body", {
                  skill: summary.mostImprovedSkill.name,
                  percent: formatNumber(
                    Math.round(summary.mostImprovedSkill.delta * 100),
                    locale,
                  ),
                })}
              </p>
            </section>
          ) : null}

          <section className="mt-6 flex flex-col gap-3">
            <h2 className="text-base font-semibold">{t("activitiesTitle")}</h2>
            {activitiesQuery.loading ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            ) : activitiesQuery.error !== null ? (
              <ErrorState
                message={apiErrorMessage(activitiesQuery.error)}
                onRetry={activitiesQuery.reload}
              />
            ) : activities.length === 0 ? (
              <p className="text-sm text-neutral-600">{tHistory("empty")}</p>
            ) : (
              <ReportTable
                head={[
                  tHistory("date"),
                  tHistory("exercise"),
                  tHistory("result"),
                  tHistory("stars"),
                  tHistory("duration"),
                ]}
                rows={activities.map((row) => [
                  formatDate(row.date, locale, "medium"),
                  row.exerciseTitle,
                  row.correct ? tHistory("correct") : tHistory("incorrect"),
                  row.stars === null ? null : formatNumber(row.stars, locale),
                  row.durationMs === null ? null : formatDuration(row.durationMs, locale),
                ])}
              />
            )}
          </section>

          <footer className="mt-8 border-t border-neutral-300 pt-4 text-center text-sm text-neutral-600">
            {t("footer")}
          </footer>
        </article>
      </div>
    </div>
  );
}
