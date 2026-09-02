import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { JsonEditor } from "@/components/json-editor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SimpleSelect, type SelectOption } from "@/components/simple-select";
import { hasVisualEditor, VisualConfigEditor } from "@/features/exercises/visual-config";
import {
  ApiError,
  createAssessmentItem,
  listExerciseTypes,
  listSkills,
  updateAssessmentItem,
} from "@/api";
import type { AssessmentItem, ExerciseTypeSummary, Skill } from "@/types";
import { parseJsonObjectText, toJsonText } from "@/lib/format";
import { getErrorMessage, useQuery } from "@/lib/use-query";
import { toast } from "sonner";

interface ItemDialogOptions {
  skills: Skill[];
  exerciseTypes: ExerciseTypeSummary[];
}

interface AssessmentItemDialogProps {
  assessmentVersionId: string;
  /** Existing item to edit, or null to create a new one. */
  item: AssessmentItem | null;
  onClose: () => void;
  onChanged: () => void;
}

export function AssessmentItemDialog({
  assessmentVersionId,
  item,
  onClose,
  onChanged,
}: AssessmentItemDialogProps) {
  const editing = item !== null;

  const { data: options, loading: optionsLoading, error: optionsError } = useQuery<ItemDialogOptions>(
    () =>
      Promise.all([listSkills(), listExerciseTypes(true)]).then(([skills, exerciseTypes]) => ({
        skills: [...skills].sort((a, b) => a.order - b.order),
        exerciseTypes,
      })),
    [],
  );

  const [skillId, setSkillId] = useState(item?.skillId ?? "");
  const [exerciseTypeVersionId, setExerciseTypeVersionId] = useState(
    item?.exerciseTypeVersionId ?? "",
  );
  const [configText, setConfigText] = useState(toJsonText(item?.configuration ?? {}));
  const [configTab, setConfigTab] = useState<"visual" | "json">("visual");
  const [submitting, setSubmitting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{ path: string; message: string }[]>([]);

  const configResult = parseJsonObjectText(configText);
  const selectedType = options?.exerciseTypes.find(
    (type) => type.latestVersion !== null && type.latestVersion.id === exerciseTypeVersionId,
  );
  const typeCode = selectedType?.code ?? item?.typeCode ?? "";

  // Default the selects to the first usable option in create mode.
  useEffect(() => {
    if (options === null || editing) {
      return;
    }
    setSkillId((current) => (current === "" ? (options.skills[0]?.id ?? "") : current));
    setExerciseTypeVersionId((current) => {
      if (current !== "") {
        return current;
      }
      return options.exerciseTypes.find((type) => type.latestVersion !== null)?.latestVersion?.id ?? "";
    });
  }, [options, editing]);

  // Types without a visual editor fall back to the JSON tab.
  useEffect(() => {
    if (typeCode !== "" && !hasVisualEditor(typeCode)) {
      setConfigTab((current) => (current === "visual" ? "json" : current));
    }
  }, [typeCode]);

  const canSubmit =
    !submitting &&
    !validating &&
    !optionsLoading &&
    options !== null &&
    skillId !== "" &&
    exerciseTypeVersionId !== "" &&
    configResult.ok;

  function resetFeedback(): void {
    setSubmitError(null);
    setValidationErrors([]);
  }

  function handleFailure(err: unknown): void {
    setSubmitError(getErrorMessage(err));
    if (err instanceof ApiError && err.validationErrors.length > 0) {
      setValidationErrors(err.validationErrors);
    }
  }

  async function handleSubmit(event?: FormEvent): Promise<void> {
    event?.preventDefault();
    if (!canSubmit || !configResult.ok) {
      return;
    }
    setSubmitting(true);
    resetFeedback();
    try {
      if (editing && item !== null) {
        await updateAssessmentItem(item.id, {
          skillId,
          configuration: configResult.value,
        });
        toast.success("Assessment item updated");
      } else {
        await createAssessmentItem({
          assessmentVersionId,
          skillId,
          exerciseTypeVersionId,
          configuration: configResult.value,
        });
        toast.success("Assessment item added");
      }
      onChanged();
      onClose();
    } catch (err) {
      handleFailure(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleValidate(): Promise<void> {
    if (!canSubmit || !configResult.ok) {
      return;
    }
    setValidating(true);
    resetFeedback();
    try {
      if (editing && item !== null) {
        // PATCH applies the current values; an invalid configuration answers
        // 400 with validationErrors, a valid one confirms the item is valid.
        await updateAssessmentItem(item.id, {
          skillId,
          configuration: configResult.value,
        });
        toast.success("Configuration is valid");
      } else {
        // There is no dedicated validate endpoint: attempt the create. An
        // invalid configuration answers 400 with validationErrors and creates
        // nothing; a valid one creates the item.
        await createAssessmentItem({
          assessmentVersionId,
          skillId,
          exerciseTypeVersionId,
          configuration: configResult.value,
        });
        toast.success("Configuration is valid — item created");
        onChanged();
        onClose();
      }
    } catch (err) {
      handleFailure(err);
    } finally {
      setValidating(false);
    }
  }

  function skillOptions(): SelectOption[] {
    return (options?.skills ?? []).map((skill) => ({ value: skill.id, label: skill.name }));
  }

  function typeOptions(): SelectOption[] {
    if (editing && item !== null) {
      // The type is fixed after creation; the item may still point at an
      // older type version than the current latest.
      const label =
        selectedType?.latestVersion != null
          ? `${selectedType.name} — v${selectedType.latestVersion.version}`
          : ((options?.exerciseTypes.find((type) => type.code === item.typeCode)?.name ??
            item.typeCode));
      return [{ value: item.exerciseTypeVersionId, label }];
    }
    return (options?.exerciseTypes ?? []).map((type) => ({
      value: type.latestVersion === null ? `none:${type.id}` : type.latestVersion.id,
      label:
        type.latestVersion === null
          ? `${type.name} (no versions)`
          : `${type.name} — v${type.latestVersion.version}`,
      disabled: type.latestVersion === null,
    }));
  }

  function handleTypeChange(next: string): void {
    setExerciseTypeVersionId(next);
    const type = options?.exerciseTypes.find(
      (candidate) => candidate.latestVersion?.id === next,
    );
    if (type === undefined || !hasVisualEditor(type.code)) {
      setConfigTab("json");
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-h-[calc(100vh-4rem)] gap-0 overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit assessment item" : "Add assessment item"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update the skill or the configuration of this diagnostic item."
              : "Each item runs a short exercise for one skill and feeds the child's starting level."}
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="assessment-item-skill">Skill</Label>
              <SimpleSelect
                id="assessment-item-skill"
                value={skillId === "" ? null : skillId}
                onValueChange={setSkillId}
                options={skillOptions()}
                placeholder="Select skill"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="assessment-item-type">Exercise type</Label>
              <SimpleSelect
                id="assessment-item-type"
                value={exerciseTypeVersionId === "" ? null : exerciseTypeVersionId}
                onValueChange={handleTypeChange}
                options={typeOptions()}
                placeholder="Select type"
                disabled={editing}
              />
              {editing ? (
                <p className="text-xs text-muted-foreground">
                  The exercise type is fixed after creation.
                </p>
              ) : null}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="assessment-item-configuration">Configuration</Label>
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
                {configResult.ok && hasVisualEditor(typeCode) ? (
                  <VisualConfigEditor
                    typeCode={typeCode}
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
                  id="assessment-item-configuration"
                  value={configText}
                  onChange={setConfigText}
                  error={configResult.ok ? null : configResult.error}
                  rows={10}
                />
              </TabsContent>
            </Tabs>
          </div>
          {optionsError !== null ? (
            <p className="text-sm text-destructive" role="alert">
              Could not load form options: {optionsError}
            </p>
          ) : null}
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting || validating}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleValidate()}
              disabled={!canSubmit}
            >
              {validating ? "Validating…" : "Validate"}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {submitting ? "Saving…" : editing ? "Save changes" : "Create item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
