import { useEffect, useMemo, useState, type FormEvent } from "react";
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
import { SimpleSelect, type SelectOption } from "@/components/simple-select";
import { StatusBadge } from "@/components/status-badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createRoadmap,
  updateRoadmap,
  addStageItem,
  deleteStageItem,
  createRoadmapVersion,
  getRoadmap,
  listExercises,
  listRoadmapCategories,
  listRoadmaps,
  publishRoadmapVersion,
  updateStage,
  updateStageItemOrder,
  deleteRoadmap,
  addRoadmapStage,
} from "@/api";
import type {
  AdminRoadmapCategory,
  ExerciseListItem,
  RoadmapCategoryRef,
  RoadmapDetail,
  RoadmapStage,
  RoadmapStageItem,
  RoadmapSummary,
  RoadmapUpdatePayload,
  RoadmapVersion,
} from "@/types";
import { getErrorMessage, useQuery, type QueryState } from "@/lib/use-query";
import { cn } from "@/lib/utils";
import {
  CoverImage,
  CoverImageField,
  type CoverValue,
} from "@/features/roadmap-categories/cover-image";
import { swapOrderUpdates } from "@/features/roadmap-categories/ordering";
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  FolderIcon,
  LoaderCircleIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

const FILTER_ALL = "__all__";
/** Select value standing for "no category" (filter and the details form). */
const NO_CATEGORY = "__none__";

function formatShortDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", { dateStyle: "medium" });
}

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
  isActive,
  version,
  stages,
  onJump,
}: {
  roadmapName: string;
  isActive: boolean;
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
            {isActive ? <Badge variant="outline">Active</Badge> : null}
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

function CategoryBadge({ category }: { category: RoadmapCategoryRef | null }) {
  return category === null ? (
    <Badge variant="outline" className="text-muted-foreground">
      Uncategorized
    </Badge>
  ) : (
    <Badge variant="secondary" className="max-w-full" title={category.name}>
      <FolderIcon />
      <span className="truncate">{category.name}</span>
    </Badge>
  );
}

/** An unpublished roadmap never reaches the child app — make that impossible to miss. */
function DraftOnlyBadge() {
  return (
    <Badge
      className="border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-300"
      title="No published version yet: children can't see this roadmap until a version is published."
    >
      <TriangleAlertIcon />
      Draft only — hidden from children
    </Badge>
  );
}

function InactiveBadge() {
  return (
    <Badge variant="secondary" title="Inactive roadmaps are hidden from children.">
      Inactive
    </Badge>
  );
}

function RoadmapListCard({
  entry,
  isFirst,
  isLast,
  busy,
  onOpen,
  onEdit,
  onToggleActive,
  onMove,
}: {
  entry: RoadmapSummary;
  isFirst: boolean;
  isLast: boolean;
  busy: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onToggleActive: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  return (
    <Card className="gap-0 py-0">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${entry.name}`}
        className="relative block w-full text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <CoverImage
          url={entry.coverUrl}
          alt={`${entry.name} cover`}
          className={cn(!entry.isActive && "opacity-60 grayscale")}
        />
        <Badge
          variant="secondary"
          className="absolute top-2 left-2 bg-background/90 tabular-nums shadow-sm backdrop-blur"
        >
          #{entry.order}
        </Badge>
      </button>
      <div className="flex flex-1 flex-col gap-2 px-4 py-3">
        <CardTitle className="truncate text-base font-semibold" title={entry.name}>
          {entry.name}
        </CardTitle>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <CategoryBadge category={entry.category} />
          {entry.isActive ? null : <InactiveBadge />}
          {entry.hasPublishedVersion ? null : <DraftOnlyBadge />}
        </div>
        {entry.description === null || entry.description === "" ? null : (
          <p className="line-clamp-2 text-sm text-muted-foreground" title={entry.description}>
            {entry.description}
          </p>
        )}
        <p className="mt-auto pt-1 text-xs text-muted-foreground">
          {entry._count.versions} {entry._count.versions === 1 ? "version" : "versions"} · created{" "}
          {formatShortDate(entry.createdAt)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1 border-t bg-muted/40 px-3 py-2">
        <Button type="button" onClick={onOpen}>
          Open
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={onEdit}>
          <PencilIcon />
          Edit details
        </Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={onToggleActive}>
          {entry.isActive ? "Deactivate" : "Activate"}
        </Button>
        <div className="ml-auto flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Move ${entry.name} up`}
            disabled={isFirst || busy}
            onClick={() => onMove(-1)}
          >
            <ChevronUpIcon />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Move ${entry.name} down`}
            disabled={isLast || busy}
            onClick={() => onMove(1)}
          >
            <ChevronDownIcon />
          </Button>
        </div>
      </div>
    </Card>
  );
}

interface RoadmapFormErrors {
  name?: string;
  order?: string;
}

/** Create (roadmap = null) or edit a roadmap's details: name, description, category, cover, order. */
function RoadmapDetailsDialog({
  open,
  roadmap,
  categories,
  onClose,
  onSaved,
}: {
  open: boolean;
  roadmap: RoadmapSummary | RoadmapDetail | null;
  categories: QueryState<AdminRoadmapCategory[]>;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState(NO_CATEGORY);
  const [cover, setCover] = useState<CoverValue>({ assetId: null, url: null });
  const [order, setOrder] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setName(roadmap?.name ?? "");
    setDescription(roadmap?.description ?? "");
    setCategoryId(roadmap?.categoryId ?? NO_CATEGORY);
    setCover({ assetId: roadmap?.coverAssetId ?? null, url: roadmap?.coverUrl ?? null });
    setOrder(roadmap === null ? "" : String(roadmap.order));
    setSubmitted(false);
  }, [open, roadmap]);

  const categoryOptions = useMemo<SelectOption[]>(() => {
    const known: RoadmapCategoryRef[] =
      categories.data ?? (roadmap?.category ? [roadmap.category] : []);
    return [
      { value: NO_CATEGORY, label: "No category" },
      ...known.map((category) => ({ value: category.id, label: category.name })),
    ];
  }, [categories.data, roadmap]);

  const parsedOrder = parseOptionalNumber(order);
  const errors: RoadmapFormErrors = {};
  if (name.trim().length < 2) {
    errors.name = "Name must be at least 2 characters.";
  }
  if (
    parsedOrder === undefined ||
    (parsedOrder !== null && (!Number.isInteger(parsedOrder) || parsedOrder < 0))
  ) {
    errors.order = "Order must be a whole number (0 or more).";
  } else if (parsedOrder === null && roadmap !== null) {
    errors.order = "Order is required.";
  }
  const hasErrors = errors.name !== undefined || errors.order !== undefined;

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitted(true);
    if (hasErrors || pending || parsedOrder === undefined) {
      return;
    }
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    const nextCategoryId = categoryId === NO_CATEGORY ? null : categoryId;
    setPending(true);
    try {
      if (roadmap === null) {
        const created = await createRoadmap({
          name: trimmedName,
          order: parsedOrder ?? undefined,
          description: trimmedDescription === "" ? undefined : trimmedDescription,
          categoryId: nextCategoryId ?? undefined,
          coverAssetId: cover.assetId ?? undefined,
        });
        toast.success("Roadmap created");
        onSaved(created.id);
      } else {
        const payload: RoadmapUpdatePayload = {};
        if (trimmedName !== roadmap.name) {
          payload.name = trimmedName;
        }
        const nextDescription = trimmedDescription === "" ? null : trimmedDescription;
        if (nextDescription !== roadmap.description) {
          payload.description = nextDescription;
        }
        if (nextCategoryId !== roadmap.categoryId) {
          payload.categoryId = nextCategoryId;
        }
        if (cover.assetId !== roadmap.coverAssetId) {
          payload.coverAssetId = cover.assetId;
        }
        if (parsedOrder !== null && parsedOrder !== roadmap.order) {
          payload.order = parsedOrder;
        }
        if (Object.keys(payload).length > 0) {
          await updateRoadmap(roadmap.id, payload);
          toast.success("Roadmap details updated");
        }
        onSaved(roadmap.id);
      }
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  const showNameError = submitted && errors.name !== undefined;
  const showOrderError = submitted && errors.order !== undefined;

  return (
    <Dialog open={open} onOpenChange={(next) => (!next && !pending ? onClose() : undefined)}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{roadmap === null ? "New roadmap" : "Edit roadmap details"}</DialogTitle>
          <DialogDescription>
            {roadmap === null
              ? "Create a roadmap and start authoring its first version. Children only see it once a version is published."
              : "Name, description, category, cover and position in the roadmap list."}
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" noValidate onSubmit={(event) => void handleSubmit(event)}>
          <div className="grid gap-1.5">
            <Label htmlFor="roadmap-name">Name</Label>
            <Input
              id="roadmap-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={showNameError}
              autoFocus
            />
            {showNameError ? <p className="text-xs text-destructive">{errors.name}</p> : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="roadmap-description">Description (optional)</Label>
            <Textarea
              id="roadmap-description"
              value={description}
              rows={3}
              className="max-h-40"
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
            <div className="grid min-w-0 gap-1.5">
              <Label htmlFor="roadmap-category">Category</Label>
              <SimpleSelect
                id="roadmap-category"
                value={categoryId}
                onValueChange={setCategoryId}
                options={categoryOptions}
                disabled={categories.loading && categories.data === null}
                placeholder={categories.loading ? "Loading categories…" : "Select a category"}
                className="w-full"
              />
              {categories.error !== null ? (
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-destructive">
                  Could not load categories.
                  <Button
                    type="button"
                    variant="link"
                    size="xs"
                    className="h-auto px-0"
                    onClick={categories.reload}
                  >
                    Retry
                  </Button>
                </p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="roadmap-order">{roadmap === null ? "Order (optional)" : "Order"}</Label>
              <Input
                id="roadmap-order"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={order}
                onChange={(event) => setOrder(event.target.value)}
                placeholder={roadmap === null ? "Auto" : undefined}
                aria-invalid={showOrderError}
              />
            </div>
            {showOrderError ? (
              <p className="text-xs text-destructive sm:col-span-2">{errors.order}</p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <span className="text-sm leading-none font-medium">Cover image (optional)</span>
            <CoverImageField value={cover} onChange={setCover} disabled={pending} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || (submitted && hasErrors)}>
              {pending ? <LoaderCircleIcon className="animate-spin" /> : null}
              {roadmap === null ? (pending ? "Creating…" : "Create") : pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Cover, category and description block at the top of the roadmap detail view. */
function RoadmapDetailsPanel({ roadmap, onEdit }: { roadmap: RoadmapDetail; onEdit: () => void }) {
  return (
    <Card className="mb-6 gap-0 py-0 sm:flex-row">
      <CoverImage
        url={roadmap.coverUrl}
        alt={`${roadmap.name} cover`}
        className="sm:w-56 sm:shrink-0 lg:w-64"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <CategoryBadge category={roadmap.category} />
          {roadmap.isActive ? null : <InactiveBadge />}
          {roadmap.hasPublishedVersion ? null : <DraftOnlyBadge />}
        </div>
        {roadmap.description === null || roadmap.description === "" ? (
          <p className="text-sm text-muted-foreground italic">No description</p>
        ) : (
          <p className="text-sm whitespace-pre-line text-muted-foreground">{roadmap.description}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Order #{roadmap.order} · created {formatShortDate(roadmap.createdAt)}
        </p>
        <div className="mt-auto pt-1">
          <Button type="button" variant="outline" onClick={onEdit}>
            <PencilIcon />
            Edit details
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ToggleActiveButton({
  id,
  isActive,
  onDone,
}: {
  id: string;
  isActive: boolean;
  onDone: () => void;
}) {
  const [pending, setPending] = useState(false);
  async function handleToggle(): Promise<void> {
    if (pending) {
      return;
    }
    setPending(true);
    try {
      await updateRoadmap(id, { isActive: !isActive });
      toast.success(isActive ? "Roadmap deactivated" : "Roadmap activated");
      onDone();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setPending(false);
    }
  }
  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() => void handleToggle()}
    >
      {pending ? <LoaderCircleIcon className="animate-spin" /> : null}
      {isActive ? "Deactivate" : "Activate"}
    </Button>
  );
}

export function RoadmapPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RoadmapSummary | null>(null);
  const [filter, setFilter] = useState(FILTER_ALL);
  const [busy, setBusy] = useState(false);

  const {
    data: roadmapsRaw,
    loading: roadmapsLoading,
    error: roadmapsError,
    reload: reloadRoadmaps,
  } = useQuery(() => listRoadmaps(), []);
  const categories = useQuery(() => listRoadmapCategories(), []);

  const roadmaps = useMemo(
    () =>
      roadmapsRaw === null
        ? null
        : [...roadmapsRaw].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)),
    [roadmapsRaw],
  );

  // Filter choices: managed categories (in their order) plus any category only seen on a roadmap.
  const filterOptions = useMemo<SelectOption[]>(() => {
    const all = roadmaps ?? [];
    const known = new Map<string, string>();
    for (const category of categories.data ?? []) {
      known.set(category.id, category.name);
    }
    for (const entry of all) {
      if (entry.category !== null && !known.has(entry.category.id)) {
        known.set(entry.category.id, entry.category.name);
      }
    }
    const uncategorized = all.filter((entry) => entry.categoryId === null).length;
    return [
      { value: FILTER_ALL, label: `All categories (${all.length})` },
      ...[...known].map(([id, name]) => ({
        value: id,
        label: `${name} (${all.filter((entry) => entry.categoryId === id).length})`,
      })),
      { value: NO_CATEGORY, label: `Uncategorized (${uncategorized})` },
    ];
  }, [roadmaps, categories.data]);

  const activeFilter = filterOptions.some((option) => option.value === filter) ? filter : FILTER_ALL;
  const visible = useMemo(
    () =>
      roadmaps === null
        ? null
        : roadmaps.filter((entry) =>
            activeFilter === FILTER_ALL
              ? true
              : activeFilter === NO_CATEGORY
                ? entry.categoryId === null
                : entry.categoryId === activeFilter,
          ),
    [roadmaps, activeFilter],
  );

  if (selectedId !== null) {
    return (
      <RoadmapDetailView
        roadmapId={selectedId}
        categories={categories}
        onBack={() => {
          setSelectedId(null);
          reloadRoadmaps();
        }}
      />
    );
  }

  const draftOnlyCount = roadmaps === null ? 0 : roadmaps.filter((entry) => !entry.hasPublishedVersion).length;

  function openDialog(roadmap: RoadmapSummary | null): void {
    setEditing(roadmap);
    setDialogOpen(true);
  }

  async function handleToggle(entry: RoadmapSummary): Promise<void> {
    setBusy(true);
    try {
      await updateRoadmap(entry.id, { isActive: !entry.isActive });
      toast.success(entry.isActive ? "Roadmap deactivated" : "Roadmap activated");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
      reloadRoadmaps();
    }
  }

  /** Swaps with the neighbour in the current (possibly filtered) view; order is global. */
  async function handleMove(index: number, direction: -1 | 1): Promise<void> {
    if (roadmaps === null || visible === null || busy) {
      return;
    }
    const current = visible[index];
    const target = visible[index + direction];
    if (current === undefined || target === undefined) {
      return;
    }
    setBusy(true);
    try {
      for (const update of swapOrderUpdates(roadmaps, current.id, target.id)) {
        await updateRoadmap(update.id, { order: update.order });
      }
      toast.success("Roadmap order updated");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
      reloadRoadmaps();
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="sticky top-14 z-10 -mx-4 mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-background/95 px-4 py-3 backdrop-blur lg:-mx-6 lg:h-16 lg:flex-nowrap lg:items-center lg:px-6 lg:py-0">
        <div className="min-w-0 flex-1 basis-40">
          <h1 className="text-lg font-semibold tracking-tight">Roadmaps</h1>
          <p className="hidden truncate text-xs text-muted-foreground sm:block">
            Manage therapy roadmaps, their versions and stage content.
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              reloadRoadmaps();
              categories.reload();
            }}
            disabled={roadmapsLoading}
          >
            <RefreshCwIcon className={cn(roadmapsLoading && "animate-spin")} />
            Refresh
          </Button>
          <Button type="button" onClick={() => openDialog(null)}>
            <PlusIcon />
            New roadmap
          </Button>
        </div>
      </div>

      {roadmapsError !== null ? (
        <ErrorState message={roadmapsError} onRetry={reloadRoadmaps} />
      ) : null}
      {roadmapsError === null && roadmapsLoading && roadmaps === null ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((cell) => (
            <Skeleton key={cell} className="aspect-[4/3] w-full rounded-xl" />
          ))}
        </div>
      ) : null}
      {roadmapsError === null && roadmaps !== null && visible !== null ? (
        roadmaps.length === 0 ? (
          <EmptyState
            title="No roadmaps yet"
            description="Create the first roadmap to start arranging therapy stages."
          >
            <Button type="button" onClick={() => openDialog(null)}>
              <PlusIcon />
              New roadmap
            </Button>
          </EmptyState>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <SimpleSelect
                value={activeFilter}
                onValueChange={setFilter}
                options={filterOptions}
                ariaLabel="Filter roadmaps by category"
                className="w-full sm:w-72"
              />
              <p className="text-xs text-muted-foreground">
                Showing {visible.length} of {roadmaps.length}{" "}
                {roadmaps.length === 1 ? "roadmap" : "roadmaps"}
                {categories.error !== null ? " · categories could not be loaded" : ""}
              </p>
            </div>
            {draftOnlyCount > 0 ? (
              <p
                role="status"
                className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300"
              >
                <TriangleAlertIcon className="mt-px size-3.5 shrink-0" />
                {draftOnlyCount === 1
                  ? "1 roadmap has no published version and is hidden from children until a version is published."
                  : `${draftOnlyCount} roadmaps have no published version and are hidden from children until a version is published.`}
              </p>
            ) : null}
            {visible.length === 0 ? (
              <EmptyState
                title="No roadmaps in this category"
                description="Assign roadmaps to it with Edit details, or pick another filter."
              >
                <Button type="button" variant="outline" onClick={() => setFilter(FILTER_ALL)}>
                  Show all roadmaps
                </Button>
              </EmptyState>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {visible.map((entry, index) => (
                  <RoadmapListCard
                    key={entry.id}
                    entry={entry}
                    isFirst={index === 0}
                    isLast={index === visible.length - 1}
                    busy={busy || roadmapsLoading}
                    onOpen={() => setSelectedId(entry.id)}
                    onEdit={() => openDialog(entry)}
                    onToggleActive={() => void handleToggle(entry)}
                    onMove={(direction) => void handleMove(index, direction)}
                  />
                ))}
              </div>
            )}
          </div>
        )
      ) : null}

      <RoadmapDetailsDialog
        open={dialogOpen}
        roadmap={editing}
        categories={categories}
        onClose={() => setDialogOpen(false)}
        onSaved={(id) => {
          reloadRoadmaps();
          categories.reload();
          if (editing === null) {
            setSelectedId(id);
          }
        }}
      />
    </div>
  );
}

function RoadmapDetailView({
  roadmapId,
  categories,
  onBack,
}: {
  roadmapId: string;
  categories: QueryState<AdminRoadmapCategory[]>;
  onBack: () => void;
}) {
  const {
    data: roadmap,
    loading: roadmapLoading,
    error: roadmapError,
    reload: reloadRoadmap,
  } = useQuery(() => getRoadmap(roadmapId), [roadmapId]);
  const { data: exercises, reload: reloadExercises } = useQuery(() => listExercises(), []);
  const [versionBusy, setVersionBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const { version, isPublished } =
    roadmap === null ? { version: null, isPublished: true } : pickVersion(roadmap.versions);
  const stages = version === null ? [] : [...version.stages].sort((a, b) => a.order - b.order);
  const draft =
    roadmap === null
      ? null
      : [...roadmap.versions]
          .filter((candidate) => candidate.status === "DRAFT")
          .sort((a, b) => b.version - a.version)[0] ?? null;

  async function handleDeleteRoadmap(): Promise<void> {
    if (versionBusy) return;
    setVersionBusy(true);
    try {
      await deleteRoadmap(roadmapId);
      toast.success("Roadmap deleted");
      onBack();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setVersionBusy(false);
    }
  }

  async function handleNewVersion(): Promise<void> {
    if (versionBusy || roadmap === null) {
      return;
    }
    setVersionBusy(true);
    try {
      await createRoadmapVersion(roadmap.id);
      toast.success("New draft version created from the latest version");
      reloadRoadmap();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setVersionBusy(false);
    }
  }

  async function handlePublish(): Promise<void> {
    if (versionBusy || draft === null) {
      return;
    }
    setVersionBusy(true);
    try {
      await publishRoadmapVersion(draft.id);
      toast.success("Draft version published");
      reloadRoadmap();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setVersionBusy(false);
    }
  }

  function handleRefresh(): void {
    reloadRoadmap();
    reloadExercises();
  }

  function handleJump(stageId: string): void {
    document
      .getElementById(`stage-${stageId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="sticky top-14 z-10 -mx-4 mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-background/95 px-4 py-3 backdrop-blur lg:-mx-6 lg:h-16 lg:flex-nowrap lg:items-center lg:px-6 lg:py-0">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Back to roadmaps" onClick={onBack}>
          <ArrowLeftIcon />
        </Button>
        <div className="min-w-0 flex-1 basis-40">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="min-w-0 truncate text-lg font-semibold tracking-tight">
              {roadmap === null ? "Roadmap" : roadmap.name}
            </h1>
            {roadmap !== null ? (
              roadmap.isActive ? (
                <Badge className="bg-emerald-600 text-white">Active</Badge>
              ) : (
                <Badge variant="secondary">Inactive</Badge>
              )
            ) : null}
            {version !== null && roadmapLoading === false ? (
              <span className="flex items-center gap-1.5">
                <Badge variant="secondary" className="tabular-nums">
                  v{version.version}
                </Badge>
                <StatusBadge status={version.status} />
              </span>
            ) : null}
          </div>
          <p className="hidden truncate text-xs text-muted-foreground sm:block">
            Arrange therapy stages, mastery rules and the exercises each stage contains.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {roadmap !== null ? (
            <ToggleActiveButton
              id={roadmap.id}
              isActive={roadmap.isActive}
              onDone={reloadRoadmap}
            />
          ) : null}
          <Button type="button" variant="outline" disabled={versionBusy} onClick={() => void handleNewVersion()}>
            {versionBusy ? <LoaderCircleIcon className="animate-spin" /> : <PlusIcon />}
            New version
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={versionBusy || draft === null}
            onClick={() => void handlePublish()}
          >
            Publish draft
          </Button>
          <Button type="button" variant="outline" onClick={handleRefresh} disabled={roadmapLoading}>
            <RefreshCwIcon className={cn(roadmapLoading && "animate-spin")} />
            Refresh
          </Button>
          <Button type="button" variant="destructive" disabled={versionBusy} onClick={() => void handleDeleteRoadmap()}>
            Delete roadmap
          </Button>
        </div>
      </div>

      {roadmapError !== null ? <ErrorState message={roadmapError} onRetry={reloadRoadmap} /> : null}
      {roadmapError === null && roadmapLoading ? <RoadmapSkeleton /> : null}
      {roadmapError === null && !roadmapLoading && roadmap !== null ? (
        <RoadmapDetailsPanel roadmap={roadmap} onEdit={() => setEditOpen(true)} />
      ) : null}
      {roadmapError === null && !roadmapLoading && roadmap !== null ? (
        version === null ? (
          <EmptyState
            title="No versions yet"
            description="This roadmap has no versions to display."
          />
        ) : (
          <div className="grid items-start gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
            <StageRail
              roadmapName={roadmap.name}
              isActive={roadmap.isActive}
              version={version}
              stages={stages}
              onJump={handleJump}
            />

            <div className="min-w-0 space-y-6">
              <p className="text-xs text-muted-foreground lg:hidden">
                v{version.version} · {version.status.charAt(0) + version.status.slice(1).toLowerCase()}
                {version.publishedAt !== null
                  ? ` · Published ${formatShortDate(version.publishedAt)}`
                  : ""}
              </p>
              {!isPublished ? (
                <p
                  className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300"
                  role="status"
                >
                  <TriangleAlertIcon className="mt-px size-3.5 shrink-0" />
                  <span>
                    Draft only — children can&apos;t see this roadmap until a version is published.
                    Showing the latest {version.status.toLowerCase()} version.
                  </span>
                </p>
              ) : null}
              {stages.length === 0 ? (
                <EmptyState
                  title="No stages in this version"
                  description="Use the Add stage button below to create one."
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
              {draft !== null ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    const name = window.prompt("Stage name");
                    if (name !== null && name.trim().length >= 1) {
                      void addRoadmapStage(version.id, name.trim()).then(() => reloadRoadmap());
                    }
                  }}
                >
                  + Add stage
                </Button>
              ) : null}
            </div>
          </div>
        )
      ) : null}
      {roadmap !== null ? (
        <RoadmapDetailsDialog
          open={editOpen}
          roadmap={roadmap}
          categories={categories}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            reloadRoadmap();
            categories.reload();
          }}
        />
      ) : null}
    </div>
  );
}
