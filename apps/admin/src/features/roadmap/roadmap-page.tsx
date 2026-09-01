import { useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SimpleSelect } from "@/components/simple-select";
import { StatusBadge } from "@/components/status-badge";
import {
  addStageItem,
  deleteStageItem,
  getRoadmap,
  listExercises,
  listRoadmaps,
  updateStage,
  updateStageItemOrder,
} from "@/api";
import type {
  ExerciseListItem,
  RoadmapStage,
  RoadmapStageItem,
  RoadmapVersion,
} from "@/types";
import { getErrorMessage, useQuery } from "@/lib/use-query";
import { cn } from "@/lib/utils";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  LoaderCircleIcon,
  PlusIcon,
  RefreshCwIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

function parseOptionalNumber(text: string): number | null | undefined {
  if (text.trim() === "") {
    return null;
  }
  const parsed = Number(text.trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}

function pickVersion(versions: RoadmapVersion[]): { version: RoadmapVersion | null; isPublished: boolean } {
  const published = versions.filter((candidate) => candidate.status === "PUBLISHED");
  if (published.length > 0) {
    return { version: published[published.length - 1], isPublished: true };
  }
  return { version: versions.length === 0 ? null : versions[versions.length - 1], isPublished: false };
}

function MasteryFields({ stage, onSaved }: { stage: RoadmapStage; onSaved: () => void }) {
  const [mastery, setMastery] = useState(String(stage.masteryThreshold));
  const [minAccuracy, setMinAccuracy] = useState(
    stage.minAccuracy === null ? "" : String(stage.minAccuracy),
  );
  const [minAttempts, setMinAttempts] = useState(
    stage.minSuccessfulAttempts === null ? "" : String(stage.minSuccessfulAttempts),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMastery(String(stage.masteryThreshold));
    setMinAccuracy(stage.minAccuracy === null ? "" : String(stage.minAccuracy));
    setMinAttempts(stage.minSuccessfulAttempts === null ? "" : String(stage.minSuccessfulAttempts));
  }, [stage]);

  const masteryValue = parseOptionalNumber(mastery);
  const accuracyValue = parseOptionalNumber(minAccuracy);
  const attemptsValue = parseOptionalNumber(minAttempts);
  const numeric =
    mastery.trim() !== "" &&
    masteryValue !== undefined &&
    accuracyValue !== undefined &&
    attemptsValue !== undefined;
  const dirty =
    mastery !== String(stage.masteryThreshold) ||
    minAccuracy !== (stage.minAccuracy === null ? "" : String(stage.minAccuracy)) ||
    minAttempts !==
      (stage.minSuccessfulAttempts === null ? "" : String(stage.minSuccessfulAttempts));

  async function handleSave(): Promise<void> {
    if (!numeric || masteryValue === undefined || !dirty || saving) {
      return;
    }
    setSaving(true);
    try {
      await updateStage(stage.id, {
        masteryThreshold: masteryValue ?? 0,
        minAccuracy: accuracyValue ?? null,
        minSuccessfulAttempts: attemptsValue ?? null,
      });
      toast.success(`Stage "${stage.name}" updated`);
      onSaved();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-3">
      <div className="grid w-full gap-1.5 sm:w-24">
        <Label htmlFor={`mastery-${stage.id}`} className="text-xs text-muted-foreground">
          Threshold %
        </Label>
        <Input
          id={`mastery-${stage.id}`}
          type="number"
          min={0}
          max={100}
          value={mastery}
          onChange={(event) => setMastery(event.target.value)}
          aria-invalid={!numeric}
          className="h-8"
        />
      </div>
      <div className="grid w-full gap-1.5 sm:w-24">
        <Label htmlFor={`accuracy-${stage.id}`} className="text-xs text-muted-foreground">
          Min accuracy %
        </Label>
        <Input
          id={`accuracy-${stage.id}`}
          type="number"
          min={0}
          max={100}
          value={minAccuracy}
          onChange={(event) => setMinAccuracy(event.target.value)}
          aria-invalid={!numeric}
          className="h-8"
        />
      </div>
      <div className="grid w-full gap-1.5 sm:w-24">
        <Label htmlFor={`attempts-${stage.id}`} className="text-xs text-muted-foreground">
          Min attempts
        </Label>
        <Input
          id={`attempts-${stage.id}`}
          type="number"
          min={0}
          value={minAttempts}
          onChange={(event) => setMinAttempts(event.target.value)}
          aria-invalid={!numeric}
          className="h-8"
        />
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={!numeric || !dirty || saving}
        onClick={() => void handleSave()}
      >
        {saving ? <LoaderCircleIcon className="animate-spin" /> : null}
        {saving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}

function StageItems({
  stage,
  exercises,
  onChanged,
}: {
  stage: RoadmapStage;
  exercises: ExerciseListItem[];
  onChanged: () => void;
}) {
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [removingItem, setRemovingItem] = useState<RoadmapStageItem | null>(null);
  const [busy, setBusy] = useState(false);

  const items = useMemo(() => [...stage.items].sort((a, b) => a.order - b.order), [stage.items]);
  const exerciseById = useMemo(
    () => Object.fromEntries(exercises.map((exercise) => [exercise.id, exercise])),
    [exercises],
  );
  const addOptions = useMemo(
    () =>
      exercises
        .filter((exercise) => exercise.latestVersion.status === "PUBLISHED")
        .map((exercise) => ({
          value: exercise.id,
          label: `${exercise.latestVersion.title} · ${exercise.latestVersion.exerciseType.code}`,
        })),
    [exercises],
  );

  async function handleAdd(): Promise<void> {
    if (selectedExercise === null || adding) {
      return;
    }
    setAdding(true);
    try {
      await addStageItem(stage.id, selectedExercise);
      toast.success("Exercise added to stage");
      setSelectedExercise(null);
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(item: RoadmapStageItem): Promise<void> {
    setBusy(true);
    try {
      await deleteStageItem(item.id);
      toast.success("Exercise removed from stage");
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
      setRemovingItem(null);
    }
  }

  async function handleMove(index: number, direction: -1 | 1): Promise<void> {
    const current = items[index];
    const target = items[index + direction];
    if (current === undefined || target === undefined || busy) {
      return;
    }
    setBusy(true);
    try {
      // Adjacent swap: move the item to the neighbour's order, then the neighbour here.
      await updateStageItemOrder(current.id, target.order);
      await updateStageItemOrder(target.id, current.order);
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-3">
      <ul className="divide-y rounded-lg border">
        {items.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">
            No exercises assigned
          </li>
        ) : (
          items.map((item, index) => {
            const meta = item.exercise === null ? undefined : exerciseById[item.exercise.id];
            return (
              <li
                key={item.id}
                className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-[0.7rem] font-medium tabular-nums text-muted-foreground">
                  {item.order}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {item.exercise === null ? (
                      <span className="italic text-muted-foreground">Missing exercise</span>
                    ) : (
                      item.exercise.title
                    )}
                  </p>
                  {meta !== undefined ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {meta.latestVersion.exerciseType.name} · {meta.latestVersion.skill.name}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Move item up"
                    disabled={index === 0 || busy}
                    onClick={() => void handleMove(index, -1)}
                  >
                    <ChevronUpIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Move item down"
                    disabled={index === items.length - 1 || busy}
                    onClick={() => void handleMove(index, 1)}
                  >
                    <ChevronDownIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Remove item"
                    disabled={busy}
                    onClick={() => setRemovingItem(item)}
                  >
                    <XIcon className="text-destructive" />
                  </Button>
                </div>
              </li>
            );
          })
        )}
      </ul>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SimpleSelect
          value={selectedExercise}
          onValueChange={setSelectedExercise}
          options={addOptions}
          placeholder={addOptions.length === 0 ? "No published exercises" : "Select an exercise…"}
          ariaLabel={`Add exercise to stage ${stage.name}`}
          className="min-w-0 sm:w-72 sm:flex-1"
        />
        <Button
          type="button"
          variant="outline"
          disabled={selectedExercise === null || adding}
          onClick={() => void handleAdd()}
        >
          {adding ? <LoaderCircleIcon className="animate-spin" /> : <PlusIcon />}
          {adding ? "Adding…" : "Add"}
        </Button>
      </div>

      <AlertDialog
        open={removingItem !== null}
        onOpenChange={(open) => (!open ? setRemovingItem(null) : undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this exercise from the stage?</AlertDialogTitle>
            <AlertDialogDescription>
              The exercise itself is not deleted — it only disappears from this roadmap stage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={() => {
                if (removingItem !== null) {
                  void handleRemove(removingItem);
                }
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StageCard({
  stage,
  exercises,
  onChanged,
}: {
  stage: RoadmapStage;
  exercises: ExerciseListItem[];
  onChanged: () => void;
}) {
  const itemCount = stage.items.length;
  return (
    <Card id={`stage-${stage.id}`} className="scroll-mt-32 gap-0 py-0">
      <div className="flex items-start gap-3 border-b bg-muted/40 px-4 py-4 sm:px-5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold tabular-nums text-primary">
          {stage.order}
        </span>
        <div className="min-w-0 flex-1">
          <CardTitle className="truncate text-lg leading-snug font-semibold">
            {stage.name}
          </CardTitle>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {stage.skills.length === 0 ? (
              <span className="text-xs text-muted-foreground italic">No skills</span>
            ) : (
              stage.skills.map((skill) => (
                <Badge key={skill.id} variant="secondary" className="font-normal">
                  {skill.name}
                </Badge>
              ))
            )}
          </div>
        </div>
        <Badge variant="outline" className="shrink-0 tabular-nums">
          {itemCount} {itemCount === 1 ? "exercise" : "exercises"}
        </Badge>
      </div>
      <div className="px-4 py-4 sm:px-5">
        <p className="text-[0.7rem] font-semibold tracking-wider text-muted-foreground uppercase">
          Mastery rules
        </p>
        <MasteryFields stage={stage} onSaved={onChanged} />
      </div>
      <div className="border-t px-4 py-4 sm:px-5">
        <p className="text-[0.7rem] font-semibold tracking-wider text-muted-foreground uppercase">
          Exercises
        </p>
        <StageItems stage={stage} exercises={exercises} onChanged={onChanged} />
      </div>
    </Card>
  );
}

function StageRail({
  roadmapName,
  isDefault,
  version,
  stages,
  onJump,
}: {
  roadmapName: string;
  isDefault: boolean;
  version: RoadmapVersion;
  stages: RoadmapStage[];
  onJump: (stageId: string) => void;
}) {
  const totalAssigned = stages.reduce((sum, stage) => sum + stage.items.length, 0);
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-32 space-y-5">
        <div>
          <p className="text-sm font-semibold">{roadmapName}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="tabular-nums">
              v{version.version}
            </Badge>
            <StatusBadge status={version.status} />
            {isDefault ? <Badge variant="outline">Default</Badge> : null}
          </div>
          {version.publishedAt !== null ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Published{" "}
              {new Date(version.publishedAt).toLocaleDateString("en-GB", { dateStyle: "medium" })}
            </p>
          ) : null}
        </div>
        <nav aria-label="Roadmap stages">
          <p className="px-2 text-[0.7rem] font-semibold tracking-wider text-muted-foreground uppercase">
            Stages
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {stages.map((stage) => (
              <li key={stage.id}>
                <button
                  type="button"
                  onClick={() => onJump(stage.id)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                >
                  <span className="w-4 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {stage.order}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{stage.name}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {stage.items.length}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <p className="border-t pt-4 text-xs text-muted-foreground">
          {stages.length} {stages.length === 1 ? "stage" : "stages"} · {totalAssigned}{" "}
          {totalAssigned === 1 ? "exercise" : "exercises"} assigned
        </p>
      </div>
    </aside>
  );
}

function RoadmapSkeleton() {
  return (
    <div className="grid items-start gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <div className="hidden space-y-4 lg:block">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-44 w-full" />
      </div>
      <div className="space-y-6">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    </div>
  );
}

export function RoadmapPage() {
  const {
    data: roadmaps,
    loading: roadmapsLoading,
    error: roadmapsError,
    reload: reloadRoadmaps,
  } = useQuery(() => listRoadmaps(), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (roadmaps === null) {
      return;
    }
    if (selectedId !== null && !roadmaps.some((roadmap) => roadmap.id === selectedId)) {
      setSelectedId(roadmaps.length === 0 ? null : roadmaps[0].id);
      return;
    }
    if (selectedId === null && roadmaps.length > 0) {
      setSelectedId(roadmaps[0].id);
    }
  }, [roadmaps, selectedId]);

  const {
    data: roadmap,
    loading: roadmapLoading,
    error: roadmapError,
    reload: reloadRoadmap,
  } = useQuery(
    () => (selectedId === null ? Promise.resolve(null) : getRoadmap(selectedId)),
    [selectedId],
  );
  const { data: exercises, reload: reloadExercises } = useQuery(() => listExercises(), []);

  const { version, isPublished } =
    roadmap === null ? { version: null, isPublished: true } : pickVersion(roadmap.versions);
  const stages =
    version === null ? [] : [...version.stages].sort((a, b) => a.order - b.order);

  const roadmapOptions = (roadmaps ?? []).map((summary) => ({
    value: summary.id,
    label: summary.isDefault ? `${summary.name} · Default` : summary.name,
  }));
  const refreshing = roadmapsLoading || roadmapLoading;

  function handleRefresh(): void {
    reloadRoadmaps();
    reloadRoadmap();
    reloadExercises();
  }

  function handleJump(stageId: string): void {
    document.getElementById(`stage-${stageId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="sticky top-14 z-10 -mx-4 mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-background/95 px-4 py-3 backdrop-blur lg:-mx-6 lg:h-16 lg:flex-nowrap lg:items-center lg:px-6 lg:py-0">
        <div className="min-w-0 flex-1 basis-40">
          <h1 className="text-lg font-semibold tracking-tight">Roadmap</h1>
          <p className="hidden truncate text-xs text-muted-foreground sm:block">
            Arrange therapy stages, mastery rules and the exercises each stage contains.
          </p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <SimpleSelect
            value={selectedId}
            onValueChange={setSelectedId}
            options={roadmapOptions}
            placeholder={roadmapOptions.length === 0 ? "No roadmaps" : "Select roadmap…"}
            disabled={roadmapOptions.length === 0}
            ariaLabel="Select roadmap"
            className="min-w-0 flex-1 sm:w-56 sm:flex-none"
          />
          <Button type="button" variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCwIcon className={cn(refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {roadmapsError !== null ? <ErrorState message={roadmapsError} onRetry={reloadRoadmaps} /> : null}
      {roadmapsError === null && roadmapsLoading ? <RoadmapSkeleton /> : null}
      {roadmapsError === null && !roadmapsLoading && roadmaps !== null ? (
        roadmaps.length === 0 ? (
          <EmptyState
            title="No roadmaps yet"
            description="Roadmaps are created by the platform; none exist so far."
          />
        ) : (
          <div className="grid items-start gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
            {roadmap !== null && version !== null ? (
              <StageRail
                roadmapName={roadmap.name}
                isDefault={roadmap.isDefault}
                version={version}
                stages={stages}
                onJump={handleJump}
              />
            ) : (
              <div className="hidden lg:block" />
            )}

            <div className="min-w-0 space-y-6">
              {roadmapError !== null ? (
                <ErrorState message={roadmapError} onRetry={reloadRoadmap} />
              ) : null}
              {roadmapError === null && roadmapLoading ? (
                <div className="space-y-6">
                  <Skeleton className="h-56 w-full" />
                  <Skeleton className="h-56 w-full" />
                </div>
              ) : null}
              {roadmapError === null && !roadmapLoading && roadmap !== null ? (
                version === null ? (
                  <EmptyState
                    title="No versions yet"
                    description="This roadmap has no versions to display."
                  />
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground lg:hidden">
                      v{version.version} · {version.status.charAt(0) + version.status.slice(1).toLowerCase()}
                      {version.publishedAt !== null
                        ? ` · Published ${new Date(version.publishedAt).toLocaleDateString("en-GB", { dateStyle: "medium" })}`
                        : ""}
                    </p>
                    {!isPublished ? (
                      <p
                        className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400"
                        role="status"
                      >
                        This roadmap has no published version — showing the latest{" "}
                        {version.status.toLowerCase()} version.
                      </p>
                    ) : null}
                    {stages.length === 0 ? (
                      <EmptyState
                        title="No stages in this version"
                        description="Stages are defined when the roadmap version is authored."
                      />
                    ) : (
                      stages.map((stage) => (
                        <StageCard
                          key={stage.id}
                          stage={stage}
                          exercises={exercises ?? []}
                          onChanged={reloadRoadmap}
                        />
                      ))
                    )}
                  </>
                )
              ) : null}
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}
