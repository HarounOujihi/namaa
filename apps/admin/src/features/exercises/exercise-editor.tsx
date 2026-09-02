import { useEffect, useRef, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { JsonEditor } from "@/components/json-editor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { hasVisualEditor, VisualConfigEditor } from "./visual-config";
import { PreviewExerciseDialog } from "@/components/preview-exercise-dialog";
import { AudioManagerDialog } from "./audio-manager-dialog";
import { SimpleSelect, type SelectOption } from "@/components/simple-select";
import { StatusBadge } from "@/components/status-badge";
import {
  ApiError,
  createExercise,
  getExercise,
  listAgeGroups,
  listDifficultyLevels,
  listExerciseTypes,
  listSkills,
  publishExercise,
  updateExercise,
  validateExercise,
} from "@/api";
import type {
  ExerciseDetail,
  ExerciseTypeSummary,
  ExerciseVersionDetail,
  Skill,
} from "@/types";
import { parseJsonObjectText, toJsonText } from "@/lib/format";
import { getErrorMessage, useQuery } from "@/lib/use-query";
import { toast } from "sonner";

const NO_AGE_GROUP = "__none__";

interface EditorOptions {
  skills: Skill[];
  difficultyLevels: { id: string; code: string; name: string; order: number }[];
  ageGroups: { id: string; code: string; label: string; minAge: number; maxAge: number }[];
  exerciseTypes: ExerciseTypeSummary[];
}

function latestVersion(detail: ExerciseDetail): ExerciseVersionDetail | null {
  let latest: ExerciseVersionDetail | null = null;
  for (const version of detail.versions) {
    if (latest === null || version.version > latest.version) {
      latest = version;
    }
  }
  return latest;
}

function schemaHint(configSchema: Record<string, unknown> | undefined): string | null {
  if (configSchema === undefined) {
    return null;
  }
  const properties = configSchema.properties;
  if (typeof properties !== "object" || properties === null || Array.isArray(properties)) {
    return null;
  }
  const keys = Object.keys(properties);
  if (keys.length === 0) {
    return null;
  }
  const required = Array.isArray(configSchema.required)
    ? configSchema.required.filter((entry): entry is string => typeof entry === "string")
    : [];
  const formatted = keys.map((key) => (required.includes(key) ? `${key} (required)` : key));
  return `Schema keys: ${formatted.join(", ")}`;
}

interface ExerciseEditorProps {
  exerciseId: string | null;
  onClose: () => void;
  onChanged: () => void;
}

export function ExerciseEditor({ exerciseId, onClose, onChanged }: ExerciseEditorProps) {
  const [currentId, setCurrentId] = useState<string | null>(exerciseId);

  const { data: options, loading: optionsLoading, error: optionsError } = useQuery<EditorOptions>(
      () =>
        Promise.all([
          listSkills(),
          listDifficultyLevels(),
          listAgeGroups(),
          listExerciseTypes(true),
        ]).then(([skills, difficultyLevels, ageGroups, exerciseTypes]) => ({
          skills: [...skills].sort((a, b) => a.order - b.order),
          difficultyLevels: [...difficultyLevels].sort((a, b) => a.order - b.order),
          ageGroups,
          exerciseTypes,
        })),
      [],
    );

  const { data: detail, error: detailError } = useQuery(
    () => (currentId === null ? Promise.resolve(null) : getExercise(currentId)),
    [currentId],
  );

  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [skillId, setSkillId] = useState("");
  const [difficultyLevelId, setDifficultyLevelId] = useState("");
  const [ageGroupId, setAgeGroupId] = useState(NO_AGE_GROUP);
  const [exerciseTypeVersionId, setExerciseTypeVersionId] = useState("");
  const [configText, setConfigText] = useState("{}");
  const [configTab, setConfigTab] = useState<"visual" | "json">("visual");
  const [snapshot, setSnapshot] = useState<ExerciseVersionDetail | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [validating, setValidating] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{ path: string; message: string }[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [audioOpen, setAudioOpen] = useState(false);

  const initializedFor = useRef<string | null>(null);
  // Once the form is initialized for an exercise (including one we just created),
  // keep it rendered while its detail refetches in the background.
  const initialized = initializedFor.current === (currentId ?? "new");
  const ready = options !== null && (currentId === null || detail !== null || initialized);
  useEffect(() => {
    if (initializedFor.current === (currentId ?? "new") || !ready) {
      return;
    }
    initializedFor.current = currentId ?? "new";
    const version = detail === null ? null : latestVersion(detail);
    setSnapshot(version);
    setTitle(version === null ? "" : version.title);
    setInstructions(version === null ? "" : (version.instructions ?? ""));
    setSkillId(version === null ? (options?.skills[0]?.id ?? "") : version.skillId);
    setDifficultyLevelId(
      version === null ? (options?.difficultyLevels[0]?.id ?? "") : version.difficultyLevelId,
    );
    setAgeGroupId(version === null ? NO_AGE_GROUP : version.ageGroupId ?? NO_AGE_GROUP);
    if (version === null) {
      const firstWithVersion = options?.exerciseTypes.find(
        (type) => type.latestVersion !== null,
      )?.latestVersion;
      setExerciseTypeVersionId(firstWithVersion?.id ?? "");
    } else {
      setExerciseTypeVersionId(version.exerciseTypeVersionId);
    }
    setConfigText(toJsonText(version === null ? {} : version.configuration));
  }, [ready, currentId, detail, options]);

  const configResult = parseJsonObjectText(configText);
  const selectedType = options?.exerciseTypes.find(
    (type) => type.latestVersion !== null && type.latestVersion.id === exerciseTypeVersionId,
  );
  const hint =
    selectedType?.latestVersion != null
      ? schemaHint(selectedType.latestVersion.configSchema)
      : null;

  const canSave =
    !submitting &&
    !optionsLoading &&
    ready &&
    title.trim() !== "" &&
    skillId !== "" &&
    difficultyLevelId !== "" &&
    (currentId !== null || exerciseTypeVersionId !== "") &&
    configResult.ok;

  const previewDisabledReason = !configResult.ok
    ? "Fix JSON errors first"
    : selectedType === undefined
      ? "Select an exercise type first"
      : null;
  const audioDisabledReason = !configResult.ok ? "Fix JSON errors first" : null;

  function skillOptions(): SelectOption[] {
    return (options?.skills ?? []).map((skill) => ({ value: skill.id, label: skill.name }));
  }

  function difficultyOptions(): SelectOption[] {
    return (options?.difficultyLevels ?? []).map((level) => ({
      value: level.id,
      label: level.name,
    }));
  }

  function ageGroupOptions(): SelectOption[] {
    return [
      { value: NO_AGE_GROUP, label: "No age group" },
      ...(options?.ageGroups ?? []).map((group) => ({
        value: group.id,
        label: `${group.label} (${group.minAge}\u2013${group.maxAge})`,
      })),
    ];
  }

  function typeVersionOptions(): SelectOption[] {
    return (options?.exerciseTypes ?? []).map((type) => ({
      value: type.latestVersion === null ? `none:${type.id}` : type.latestVersion.id,
      label:
        type.latestVersion === null
          ? `${type.name} (no versions)`
          : `${type.name} — v${type.latestVersion.version}`,
      disabled: type.latestVersion === null,
    }));
  }

  function resetFeedback(): void {
    setSubmitError(null);
    setValidationErrors([]);
  }

  async function handleSave(event?: FormEvent): Promise<void> {
    event?.preventDefault();
    if (!canSave || !configResult.ok) {
      return;
    }
    setSubmitting(true);
    resetFeedback();
    try {
      if (currentId === null) {
        const created = await createExercise({
          title: title.trim(),
          instructions: instructions.trim() === "" ? undefined : instructions.trim(),
          skillId,
          difficultyLevelId,
          ageGroupId: ageGroupId === NO_AGE_GROUP ? undefined : ageGroupId,
          exerciseTypeVersionId,
          configuration: configResult.value,
        });
        setCurrentId(created.id);
        // The form is already populated; skip re-initialization when the detail loads.
        initializedFor.current = created.id;
        const createdLatest = latestVersion(created);
        setSnapshot(createdLatest);
        toast.success("Exercise created as draft");
      } else {
        const updated = await updateExercise(currentId, {
          title: title.trim(),
          instructions: instructions.trim() === "" ? null : instructions.trim(),
          skillId,
          difficultyLevelId,
          ageGroupId: ageGroupId === NO_AGE_GROUP ? null : ageGroupId,
          configuration: configResult.value,
        });
        setSnapshot(latestVersion(updated));
        toast.success("Draft version saved");
      }
      onChanged();
    } catch (err) {
      setSubmitError(getErrorMessage(err));
      if (err instanceof ApiError && err.validationErrors.length > 0) {
        setValidationErrors(err.validationErrors);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleValidate(): Promise<void> {
    if (currentId === null || validating) {
      return;
    }
    setValidating(true);
    resetFeedback();
    try {
      const result = await validateExercise(currentId);
      if (result.valid) {
        toast.success("Exercise configuration is valid");
      } else {
        setValidationErrors(result.errors);
        toast.error(`Exercise is invalid (${result.errors.length} problem${result.errors.length === 1 ? "" : "s"})`);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setValidating(false);
    }
  }

  /** True when the form differs from the last saved version. */
  function isDirty(): boolean {
    if (snapshot === null) {
      return true;
    }
    return (
      title.trim() !== snapshot.title ||
      (instructions.trim() === "" ? null : instructions.trim()) !== (snapshot.instructions ?? null) ||
      skillId !== snapshot.skillId ||
      difficultyLevelId !== snapshot.difficultyLevelId ||
      (ageGroupId === NO_AGE_GROUP ? null : ageGroupId) !== (snapshot.ageGroupId ?? null) ||
      JSON.stringify(configResult.ok ? configResult.value : null) !== JSON.stringify(snapshot.configuration)
    );
  }

  async function handlePublish(): Promise<void> {
    if (currentId === null || publishing) {
      return;
    }
    if (!canSave || !configResult.ok) {
      toast.error("Fix the form errors before publishing");
      return;
    }
    setPublishing(true);
    resetFeedback();
    try {
      // Publishing must never silently drop unsaved edits: save them as a new
      // draft version first, then publish that version.
      const dirty = isDirty();
      if (dirty) {
        const updated = await updateExercise(currentId, {
          title: title.trim(),
          instructions: instructions.trim() === "" ? null : instructions.trim(),
          skillId,
          difficultyLevelId,
          ageGroupId: ageGroupId === NO_AGE_GROUP ? null : ageGroupId,
          configuration: configResult.value,
        });
        setSnapshot(latestVersion(updated));
      }
      const published = await publishExercise(currentId);
      setSnapshot(latestVersion(published));
      toast.success(dirty ? "Changes saved and published" : "Exercise published");
      onChanged();
    } catch (err) {
      setSubmitError(getErrorMessage(err));
      if (err instanceof ApiError && err.validationErrors.length > 0) {
        setValidationErrors(err.validationErrors);
      }
    } finally {
      setPublishing(false);
    }
  }

  const headerStatus = snapshot === null ? null : (
    <div className="flex items-center gap-2">
      <StatusBadge status={snapshot.status} />
      <Badge variant="outline" className="font-mono">
        v{snapshot.version}
      </Badge>
    </div>
  );

  return (
    <Sheet open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <SheetContent className="w-full gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle className="flex flex-wrap items-center justify-between gap-2 pr-8">
            <span>{currentId === null ? "New exercise" : "Edit exercise"}</span>
            {headerStatus}
          </SheetTitle>
          <SheetDescription>
            {currentId === null
              ? "Create a draft exercise. Saving creates the first draft version."
              : "Saving edits creates a new draft version of this exercise."}
          </SheetDescription>
        </SheetHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => void handleSave(event)}
        >
          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
            {optionsError !== null ? (
              <p className="text-sm text-destructive" role="alert">
                Could not load form options: {optionsError}
              </p>
            ) : null}
            {currentId !== null && detailError !== null ? (
              <p className="text-sm text-destructive" role="alert">
                Could not load exercise: {detailError}
              </p>
            ) : null}
            {optionsLoading || (currentId !== null && detail === null && !initialized) ? (
              <div className="space-y-3">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-2/3" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : null}
            {ready ? (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="exercise-title">Title</Label>
                  <Input
                    id="exercise-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Match the letters"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="exercise-instructions">Instructions</Label>
                  <Textarea
                    id="exercise-instructions"
                    value={instructions}
                    onChange={(event) => setInstructions(event.target.value)}
                    rows={3}
                    placeholder="Spoken instructions shown to the child before the exercise starts"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="exercise-skill">Skill</Label>
                    <SimpleSelect
                      id="exercise-skill"
                      value={skillId === "" ? null : skillId}
                      onValueChange={setSkillId}
                      options={skillOptions()}
                      placeholder="Select skill"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="exercise-difficulty">Difficulty</Label>
                    <SimpleSelect
                      id="exercise-difficulty"
                      value={difficultyLevelId === "" ? null : difficultyLevelId}
                      onValueChange={setDifficultyLevelId}
                      options={difficultyOptions()}
                      placeholder="Select difficulty"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="exercise-age-group">Age group</Label>
                    <SimpleSelect
                      id="exercise-age-group"
                      value={ageGroupId}
                      onValueChange={setAgeGroupId}
                      options={ageGroupOptions()}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="exercise-type">Exercise type</Label>
                    <SimpleSelect
                      id="exercise-type"
                      value={exerciseTypeVersionId === "" ? null : exerciseTypeVersionId}
                      onValueChange={setExerciseTypeVersionId}
                      options={typeVersionOptions()}
                      placeholder="Select type"
                      disabled={currentId !== null}
                    />
                    {currentId !== null ? (
                      <p className="text-xs text-muted-foreground">
                        The exercise type is fixed after creation.
                      </p>
                    ) : null}
                  </div>
                </div>
                <Separator />
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="exercise-configuration">Configuration</Label>
                    {hint !== null ? (
                      <p className="text-xs text-muted-foreground">{hint}</p>
                    ) : null}
                  </div>
                  <Tabs
                    value={configTab}
                    onValueChange={(tab) => {
                      if (tab === "visual" && !configResult.ok) {
                        toast.error("Fix the JSON errors before switching to the visual editor");
                        return;
                      }
                      setConfigTab(tab);
                    }}
                  >
                    <TabsList>
                      <TabsTrigger value="visual">Visual editor</TabsTrigger>
                      <TabsTrigger value="json">JSON (advanced)</TabsTrigger>
                    </TabsList>
                    <TabsContent value="visual" className="mt-3">
                      {configResult.ok && hasVisualEditor(selectedType?.code ?? "") ? (
                        <VisualConfigEditor
                          typeCode={selectedType?.code ?? ""}
                          configuration={configResult.value}
                          onChange={(next) => setConfigText(JSON.stringify(next, null, 2))}
                        />
                      ) : (
                        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                          {configResult.ok
                            ? "No visual editor for this exercise type yet — use the JSON tab."
                            : "The configuration JSON is invalid — fix it in the JSON tab first."}
                        </div>
                      )}
                    </TabsContent>
                    <TabsContent value="json" className="mt-3">
                      <JsonEditor
                        id="exercise-configuration"
                        value={configText}
                        onChange={setConfigText}
                        error={configResult.ok ? null : configResult.error}
                        rows={10}
                      />
                    </TabsContent>
                  </Tabs>
                </div>
                {validationErrors.length > 0 ? (
                  <ul className="space-y-1 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                    {validationErrors.map((validationError) => (
                      <li key={`${validationError.path}:${validationError.message}`}>
                        <span className="font-mono">{validationError.path}</span> —{" "}
                        {validationError.message}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {submitError !== null ? (
                  <p className="text-sm text-destructive" role="alert">
                    {submitError}
                  </p>
                ) : null}
              </>
            ) : null}
          </div>

          <div className="flex flex-col-reverse gap-2 border-t bg-muted/50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentId === null || validating}
                onClick={() => void handleValidate()}
                title={currentId === null ? "Save the draft first" : undefined}
              >
                Validate
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={previewDisabledReason !== null}
                onClick={() => setPreviewOpen(true)}
                title={previewDisabledReason ?? undefined}
              >
                Preview
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={audioDisabledReason !== null}
                onClick={() => setAudioOpen(true)}
                title={audioDisabledReason ?? undefined}
              >
                Audio
              </Button>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="submit" size="sm" disabled={!canSave}>
                {submitting ? "Saving…" : "Save draft"}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={currentId === null || publishing}
                onClick={() => void handlePublish()}
                title={currentId === null ? "Save the draft first" : undefined}
              >
                Publish
              </Button>
            </div>
          </div>
        </form>
        <PreviewExerciseDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          typeCode={selectedType?.code ?? ""}
          typeName={selectedType?.name ?? ""}
          configuration={configResult.ok ? configResult.value : null}
        />
        <AudioManagerDialog
          open={audioOpen}
          onOpenChange={setAudioOpen}
          configJson={configText}
          onApply={setConfigText}
        />
      </SheetContent>
    </Sheet>
  );
}
