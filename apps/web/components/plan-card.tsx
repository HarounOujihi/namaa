"use client";

import { useMemo, useState } from "react";
import {
  EyeIcon,
  EyeOffIcon,
  LoaderCircleIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/state-views";
import { getChildPlan, getChildRoadmapExercises, setExerciseVisibility } from "@/lib/api";
import { formatDate, useApiErrorMessage } from "@/lib/format";
import { useQuery } from "@/lib/use-query";

export function PlanCard({ childId }: { childId: string }) {
  const locale = useLocale();
  const t = useTranslations("child.plan");
  const tErrors = useTranslations("errors");
  const apiErrorMessage = useApiErrorMessage();
  const planQuery = useQuery(() => getChildPlan(childId), [childId]);
  const roadmapQuery = useQuery(() => getChildRoadmapExercises(childId), [childId]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const hiddenIds = useMemo(
    () => new Set(planQuery.data?.hiddenExercises.map((entry) => entry.id) ?? []),
    [planQuery.data],
  );
  const options = useMemo(() => {
    const byId = new Map<string, { id: string; title: string; stageName: string }>();
    for (const option of roadmapQuery.data ?? []) {
      if (!byId.has(option.id) && !hiddenIds.has(option.id)) {
        byId.set(option.id, option);
      }
    }
    return [...byId.values()];
  }, [roadmapQuery.data, hiddenIds]);

  const selectedTitle =
    options.find((option) => option.id === selectedId)?.title ??
    (roadmapQuery.data ?? []).find((option) => option.id === selectedId)?.title ??
    "";

  async function applyVisibility(
    exerciseId: string,
    hidden: boolean,
    title: string,
  ): Promise<void> {
    setPendingId(exerciseId);
    try {
      await setExerciseVisibility(childId, exerciseId, hidden);
      toast.success(hidden ? t("hiddenToast", { title }) : t("shownToast", { title }));
      if (hidden) {
        setSelectedId(null);
      }
      planQuery.reload();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          {roadmapQuery.loading ? (
            <Skeleton className="h-8 w-full" />
          ) : roadmapQuery.error !== null ? (
            <div className="flex items-center gap-2 text-sm text-destructive" role="alert">
              <span className="flex-1">{apiErrorMessage(roadmapQuery.error)}</span>
              <Button
                variant="ghost"
                size="xs"
                onClick={roadmapQuery.reload}
                aria-label={tErrors("retry")}
              >
                <RotateCcwIcon />
                {tErrors("retry")}
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger
                  className="w-full"
                  disabled={options.length === 0}
                  aria-label={t("choose")}
                >
                  <SelectValue
                    placeholder={
                      options.length === 0 ? t("hiddenEmpty") : t("choose")
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {options.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                disabled={selectedId === null || pendingId !== null}
                onClick={() => void applyVisibility(selectedId!, true, selectedTitle)}
              >
                {pendingId !== null && selectedId !== null && pendingId === selectedId ? (
                  <LoaderCircleIcon className="animate-spin" />
                ) : (
                  <EyeOffIcon />
                )}
                {t("hide")}
              </Button>
            </div>
          )}
        </div>

        <Separator />

        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t("hiddenTitle")}
          </p>
          {planQuery.loading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : planQuery.error !== null ? (
            <ErrorState message={apiErrorMessage(planQuery.error)} onRetry={planQuery.reload} />
          ) : (planQuery.data?.hiddenExercises.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">{t("hiddenEmpty")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {planQuery.data?.hiddenExercises.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2"
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{entry.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {t("hiddenOn", { date: formatDate(entry.updatedAt, locale, "medium") })}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pendingId !== null}
                    onClick={() => void applyVisibility(entry.id, false, entry.title)}
                  >
                    {pendingId === entry.id ? (
                      <LoaderCircleIcon className="animate-spin" />
                    ) : (
                      <EyeIcon />
                    )}
                    {t("show")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
