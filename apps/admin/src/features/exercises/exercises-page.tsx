import { useEffect, useState } from "react";
import { PageHeader, EmptyState, ErrorState } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SimpleSelect } from "@/components/simple-select";
import { StatusBadge } from "@/components/status-badge";
import {
  ApiError,
  archiveExercise,
  cloneExercise,
  listExercises,
  listSkills,
  publishExercise,
  validateExercise,
} from "@/api";
import type { ExerciseListItem } from "@/types";
import { useQuery } from "@/lib/use-query";
import { EllipsisIcon, PlusIcon, SearchIcon } from "lucide-react";
import { toast } from "sonner";
import { ExerciseEditor } from "./exercise-editor";

const FILTER_ALL = "__all__";

const STATUS_OPTIONS = [
  { value: FILTER_ALL, label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "REVIEW", label: "Review" },
  { value: "PUBLISHED", label: "Published" },
  { value: "ARCHIVED", label: "Archived" },
];

type PendingConfirm =
  | { kind: "publish"; exercise: ExerciseListItem }
  | { kind: "archive"; exercise: ExerciseListItem }
  | null;

function formatValidationErrors(err: ApiError): string {
  const details = err.validationErrors.map((validationError) => `${validationError.path} — ${validationError.message}`);
  return details.length === 0 ? err.message : `${err.message}: ${details.join("; ")}`;
}

function StageChips({ stageNames }: { stageNames: string[] }) {
  if (stageNames.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const visible = stageNames.slice(0, 3);
  const remaining = stageNames.length - visible.length;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {visible.map((stage) => (
        <Badge key={stage} variant="secondary" className="font-normal">
          {stage}
        </Badge>
      ))}
      {remaining > 0 ? (
        <span className="text-xs text-muted-foreground">+{remaining}</span>
      ) : null}
    </div>
  );
}

export function ExercisesPage() {
  const [status, setStatus] = useState(FILTER_ALL);
  const [skillId, setSkillId] = useState(FILTER_ALL);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [editorFor, setEditorFor] = useState<string | null | undefined>(undefined);
  const [confirm, setConfirm] = useState<PendingConfirm>(null);
  const [mutating, setMutating] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const { data: skills } = useQuery(() => listSkills(), []);
  const {
    data: exercises,
    loading,
    error,
    reload,
  } = useQuery(
    () =>
      listExercises({
        status: status === FILTER_ALL ? undefined : status,
        skillId: skillId === FILTER_ALL ? undefined : skillId,
        q: query === "" ? undefined : query,
      }),
    [status, skillId, query],
  );

  function reportError(err: unknown): void {
    if (err instanceof ApiError && err.validationErrors.length > 0) {
      toast.error(formatValidationErrors(err));
      return;
    }
    toast.error(err instanceof Error && err.message !== "" ? err.message : "Something went wrong");
  }

  async function handleValidate(exercise: ExerciseListItem): Promise<void> {
    try {
      const result = await validateExercise(exercise.id);
      if (result.valid) {
        toast.success(`"${exercise.latestVersion.title}" is valid`);
      } else {
        const details = result.errors
          .map((validationError) => `${validationError.path} — ${validationError.message}`)
          .join("; ");
        toast.error(`"${exercise.latestVersion.title}" is invalid`, {
          description: details,
        });
      }
    } catch (err) {
      reportError(err);
    }
  }

  async function handleConfirm(): Promise<void> {
    if (confirm === null || mutating) {
      return;
    }
    setMutating(true);
    try {
      if (confirm.kind === "publish") {
        await publishExercise(confirm.exercise.id);
        toast.success(`"${confirm.exercise.latestVersion.title}" published`);
      } else {
        await archiveExercise(confirm.exercise.id);
        toast.success(`"${confirm.exercise.latestVersion.title}" archived`);
      }
      reload();
    } catch (err) {
      reportError(err);
    } finally {
      setMutating(false);
      setConfirm(null);
    }
  }

  async function handleClone(exercise: ExerciseListItem): Promise<void> {
    try {
      await cloneExercise(exercise.id);
      toast.success(`"${exercise.latestVersion.title}" cloned as a new draft`);
      reload();
    } catch (err) {
      reportError(err);
    }
  }

  const skillOptions = [
    { value: FILTER_ALL, label: "All skills" },
    ...(skills ?? []).map((skill) => ({ value: skill.id, label: skill.name })),
  ];

  const hasFilters = status !== FILTER_ALL || skillId !== FILTER_ALL || query !== "";

  return (
    <div>
      <PageHeader
        title="Exercises"
        description="Manage every exercise version across skills, types and statuses."
      >
        <Button onClick={() => setEditorFor(null)}>
          <PlusIcon />
          New exercise
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SimpleSelect
          value={status}
          onValueChange={setStatus}
          options={STATUS_OPTIONS}
          ariaLabel="Filter by status"
          className="w-40"
        />
        <SimpleSelect
          value={skillId}
          onValueChange={setSkillId}
          options={skillOptions}
          ariaLabel="Filter by skill"
          className="w-44"
        />
        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by title…"
            className="pl-8"
            aria-label="Search exercises by title"
          />
        </div>
      </div>

      {error !== null ? <ErrorState message={error} onRetry={reload} /> : null}
      {error === null && loading ? (
        <Card className="p-4">
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((row) => (
              <Skeleton key={row} className="h-10 w-full" />
            ))}
          </div>
        </Card>
      ) : null}
      {error === null && !loading && exercises !== null ? (
        exercises.length === 0 ? (
          <EmptyState
            title={hasFilters ? "No exercises match the filters" : "No exercises yet"}
            description={
              hasFilters
                ? "Try clearing the filters or refining your search."
                : "Create the first exercise to start filling the therapy roadmap."
            }
          />
        ) : (
          <Card className="overflow-hidden py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Skill</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Stages</TableHead>
                  <TableHead className="text-right">Versions</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {exercises.map((exercise) => (
                  <TableRow
                    key={exercise.id}
                    className="cursor-pointer"
                    onClick={() => setEditorFor(exercise.id)}
                  >
                    <TableCell className="max-w-64">
                      <div className="truncate font-medium">{exercise.latestVersion.title}</div>
                      <div className="text-xs text-muted-foreground">
                        v{exercise.latestVersion.version}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">{exercise.latestVersion.exerciseType.code}</span>
                    </TableCell>
                    <TableCell className="text-sm">{exercise.latestVersion.skill.name}</TableCell>
                    <TableCell>
                      <StatusBadge status={exercise.latestVersion.status} />
                    </TableCell>
                    <TableCell>
                      <StageChips stageNames={exercise.stageNames} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {exercise.versionsCount}
                    </TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon-sm" aria-label="Row actions" />
                          }
                        >
                          <EllipsisIcon />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditorFor(exercise.id)}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void handleValidate(exercise)}>
                            Validate
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setConfirm({ kind: "publish", exercise })}>
                            Publish
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setConfirm({ kind: "archive", exercise })}>
                            Archive
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => void handleClone(exercise)}>
                            Clone
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )
      ) : null}

      {editorFor !== undefined ? (
        <ExerciseEditor
          exerciseId={editorFor}
          onClose={() => {
            setEditorFor(undefined);
            reload();
          }}
          onChanged={reload}
        />
      ) : null}

      <AlertDialog open={confirm !== null} onOpenChange={(open) => (!open ? setConfirm(null) : undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "archive" ? "Archive this exercise?" : "Publish this exercise?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === null
                ? ""
                : confirm.kind === "archive"
                  ? `"${confirm.exercise.latestVersion.title}" will be archived. Children will no longer receive it.`
                  : `"${confirm.exercise.latestVersion.title}" (v${confirm.exercise.latestVersion.version}) will be published if it passes validation.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={confirm?.kind === "archive" ? "destructive" : "default"}
              disabled={mutating}
              onClick={() => void handleConfirm()}
            >
              {confirm?.kind === "archive" ? "Archive" : "Publish"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
