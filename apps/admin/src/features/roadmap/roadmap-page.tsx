import { useEffect, useMemo, useState } from "react";
import { PageHeader, EmptyState, ErrorState } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import type { ExerciseListItem, RoadmapStage, RoadmapVersion } from "@/types";
import { getErrorMessage, useQuery } from "@/lib/use-query";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

const NO_EXERCISE = "__none__";

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
    minAttempts !== (stage.minSuccessfulAttempts === null ? "" : String(stage.minSuccessfulAttempts));

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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end">
      <div className="grid gap-1.5">
        <Label htmlFor={`mastery-${stage.id}`} className="text-xs text-muted-foreground">
          Mastery threshold
        </Label>
        <Input
          id={`mastery-${stage.id}`}
          type="number"
          min={0}
          value={mastery}
          onChange={(event) => setMastery(event.target.value)}
          aria-invalid={!numeric}
          className="h-8"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`accuracy-${stage.id}`} className="text-xs text-muted-foreground">
          Min accuracy (%)
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
      <div className="grid gap-1.5">
        <Label htmlFor={`attempts-${stage.id}`} className="text-xs text-muted-foreground">
          Min successful attempts
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
        size="sm"
        variant="outline"
        disabled={!numeric || !dirty || saving}
        onClick={() => void handleSave()}
      >
        {saving ? "Saving…" : "Save mastery"}
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
  const [selectedExercise, setSelectedExercise] = useState(NO_EXERCISE);
  const [adding, setAdding] = useState(false);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const items = useMemo(() => [...stage.items].sort((a, b) => a.order - b.order), [stage.items]);
  const exerciseOptions = [
    { value: NO_EXERCISE, label: "Select an exercise…" },
    ...exercises.map((exercise) => ({
      value: exercise.id,
      label: `${exercise.latestVersion.title} (${exercise.latestVersion.exerciseType.code})`,
    })),
  ];

  async function handleAdd(): Promise<void> {
    if (selectedExercise === NO_EXERCISE || adding) {
      return;
    }
    setAdding(true);
    try {
      await addStageItem(stage.id, selectedExercise);
      toast.success("Exercise added to stage");
      setSelectedExercise(NO_EXERCISE);
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(itemId: string): Promise<void> {
    setBusy(true);
    try {
      await deleteStageItem(itemId);
      toast.success("Exercise removed from stage");
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
      setRemovingItemId(null);
    }
  }

  async function handleMove(index: number, direction: -1 | 1): Promise<void> {
    const target = items[index + direction];
    const current = items[index];
    if (target === undefined || current === undefined || busy) {
      return;
    }
    setBusy(true);
    try {
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
    <div className="space-y-3">
      <ul className="divide-y rounded-lg border">
        {items.length === 0 ? (
          <li className="px-3 py-4 text-center text-sm text-muted-foreground">
            No exercises assigned to this stage yet.
          </li>
        ) : (
          items.map((item, index) => (
            <li key={item.id} className="flex items-center gap-2 px-3 py-2">
              <span className="w-6 text-right text-xs tabular-nums text-muted-foreground">
                {item.order}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">
                {item.exercise === null ? (
                  <span className="text-muted-foreground italic">Missing exercise</span>
                ) : (
                  item.exercise.title
                )}
              </span>
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
                onClick={() => setRemovingItemId(item.id)}
              >
                <Trash2Icon className="text-destructive" />
              </Button>
            </li>
          ))
        )}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <SimpleSelect
          value={selectedExercise === NO_EXERCISE ? null : selectedExercise}
          onValueChange={setSelectedExercise}
          options={exerciseOptions}
          ariaLabel={`Add exercise to stage ${stage.name}`}
          className="min-w-52 flex-1"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={selectedExercise === NO_EXERCISE || adding}
          onClick={() => void handleAdd()}
        >
          <PlusIcon />
          Add exercise
        </Button>
      </div>

      <AlertDialog
        open={removingItemId !== null}
        onOpenChange={(open) => (!open ? setRemovingItemId(null) : undefined)}
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
                if (removingItemId !== null) {
                  void handleRemove(removingItemId);
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
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="default" className="font-mono">
            Stage {stage.order}
          </Badge>
          <CardTitle className="text-base">{stage.name}</CardTitle>
        </div>
        <CardDescription>
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs">Skills:</span>
            {stage.skills.length === 0 ? (
              <span className="text-xs italic">none</span>
            ) : (
              stage.skills.map((skill) => (
                <Badge key={skill.id} variant="secondary" className="font-normal">
                  {skill.name}
                </Badge>
              ))
            )}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <MasteryFields stage={stage} onSaved={onChanged} />
        <StageItems stage={stage} exercises={exercises} onChanged={onChanged} />
      </CardContent>
    </Card>
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
  const { data: exercises } = useQuery(() => listExercises(), []);

  const { version, isPublished } =
    roadmap === null ? { version: null, isPublished: true } : pickVersion(roadmap.versions);
  const stages =
    version === null ? [] : [...version.stages].sort((a, b) => a.order - b.order);

  return (
    <div>
      <PageHeader
        title="Roadmap"
        description="Arrange therapy stages, mastery rules and the exercises each stage contains."
      />

      {roadmapsError !== null ? <ErrorState message={roadmapsError} onRetry={reloadRoadmaps} /> : null}
      {roadmapsError === null && roadmapsLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : null}
      {roadmapsError === null && !roadmapsLoading && roadmaps !== null ? (
        roadmaps.length === 0 ? (
          <EmptyState
            title="No roadmaps yet"
            description="Roadmaps are created by the platform; none exist so far."
          />
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-56">
            <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
              {roadmaps.map((roadmapSummary) => (
                <button
                  key={roadmapSummary.id}
                  type="button"
                  onClick={() => setSelectedId(roadmapSummary.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-lg border bg-card px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-muted/60",
                    roadmapSummary.id === selectedId && "border-primary/40 bg-muted",
                  )}
                >
                  <span className="truncate">{roadmapSummary.name}</span>
                  {roadmapSummary.isDefault ? (
                    <Badge variant="secondary" className="font-normal">
                      Default
                    </Badge>
                  ) : null}
                </button>
              ))}
            </nav>

            <div className="min-w-0 space-y-4">
              {roadmapError !== null ? (
                <ErrorState message={roadmapError} onRetry={reloadRoadmap} />
              ) : null}
              {roadmapError === null && roadmapLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-8 w-64" />
                  <Skeleton className="h-72 w-full" />
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
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold">
                        {roadmap.name}
                        <span className="ml-2 text-sm font-normal text-muted-foreground">
                          v{version.version}
                        </span>
                      </h2>
                      <StatusBadge status={version.status} />
                      {version.publishedAt !== null ? (
                        <span className="text-xs text-muted-foreground">
                          Published{" "}
                          {new Date(version.publishedAt).toLocaleDateString("en-GB", {
                            dateStyle: "medium",
                          })}
                        </span>
                      ) : null}
                      {!isPublished ? (
                        <p className="w-full text-xs text-amber-700" role="status">
                          This roadmap has no published version — showing the latest{" "}
                          {version.status.toLowerCase()} version.
                        </p>
                      ) : null}
                    </div>
                    {stages.length === 0 ? (
                      <EmptyState
                        title="No stages in this version"
                        description="Stages are defined when the roadmap version is authored."
                      />
                    ) : (
                      <div className="space-y-4">
                        {stages.map((stage) => (
                          <StageCard
                            key={stage.id}
                            stage={stage}
                            exercises={exercises ?? []}
                            onChanged={reloadRoadmap}
                          />
                        ))}
                      </div>
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
