import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { JsonEditor } from "@/components/json-editor";
import { ApiError, createExerciseType } from "@/api";
import { parseJsonObjectText } from "@/lib/format";
import { getErrorMessage } from "@/lib/use-query";
import { toast } from "sonner";

const UPPER_SNAKE_PATTERN = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;

interface ExerciseTypeCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function ExerciseTypeCreateDialog({ open, onOpenChange, onCreated }: ExerciseTypeCreateDialogProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [schemaText, setSchemaText] = useState("{\n  \n}");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{ path: string; message: string }[]>([]);

  const trimmedCode = code.trim();
  const codeInvalid = trimmedCode !== "" && !UPPER_SNAKE_PATTERN.test(trimmedCode);
  const schemaResult = parseJsonObjectText(schemaText);
  const canSubmit =
    !submitting &&
    trimmedCode !== "" &&
    !codeInvalid &&
    name.trim() !== "" &&
    schemaResult.ok;

  function reset(): void {
    setCode("");
    setName("");
    setDescription("");
    setSchemaText("{\n  \n}");
    setSubmitError(null);
    setValidationErrors([]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!canSubmit || !schemaResult.ok) {
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    setValidationErrors([]);
    try {
      await createExerciseType({
        code: trimmedCode,
        name: name.trim(),
        description: description.trim() === "" ? undefined : description.trim(),
        configSchema: schemaResult.value,
      });
      toast.success(`Exercise type ${trimmedCode} created`);
      onCreated();
      onOpenChange(false);
      reset();
    } catch (err) {
      setSubmitError(getErrorMessage(err));
      if (err instanceof ApiError && err.validationErrors.length > 0) {
        setValidationErrors(err.validationErrors);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset();
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New exercise type</DialogTitle>
          <DialogDescription>
            Define the type code and the JSON schema that configurations of its exercises must follow.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="exercise-type-code">Code</Label>
            <Input
              id="exercise-type-code"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="LETTER_MATCHING"
              className="font-mono"
              autoComplete="off"
              required
              aria-invalid={codeInvalid}
            />
            {codeInvalid ? (
              <p className="text-xs text-destructive" role="alert">
                Code must be UPPER_SNAKE_CASE (letters, digits, underscores).
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="exercise-type-name">Name</Label>
            <Input
              id="exercise-type-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Letter matching"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="exercise-type-description">Description (optional)</Label>
            <Textarea
              id="exercise-type-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="exercise-type-schema">Config schema (JSON)</Label>
            <JsonEditor
              id="exercise-type-schema"
              value={schemaText}
              onChange={setSchemaText}
              error={schemaResult.ok ? null : schemaResult.error}
              rows={8}
            />
          </div>
          {submitError !== null ? (
            <p className="text-sm text-destructive" role="alert">
              {submitError}
            </p>
          ) : null}
          {validationErrors.length > 0 ? (
            <ul className="space-y-1 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              {validationErrors.map((validationError) => (
                <li key={`${validationError.path}:${validationError.message}`}>
                  <span className="font-mono">{validationError.path}</span> — {validationError.message}
                </li>
              ))}
            </ul>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              Create type
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
