import { useEffect, useState } from "react";
import { ExercisePlayer } from "@dyslexia/exercise-engine";
import type { AnswerResult } from "@dyslexia/exercise-engine";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PreviewExerciseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  typeCode: string;
  typeName: string;
  configuration: unknown;
}

/**
 * Renders an exercise configuration with the real player used by the child
 * app. The editor has no presigned asset URLs, so the engine falls back to
 * text and speech synthesis for asset references.
 */
export function PreviewExerciseDialog({
  open,
  onOpenChange,
  typeCode,
  typeName,
  configuration,
}: PreviewExerciseDialogProps) {
  const [lastResult, setLastResult] = useState<AnswerResult | null>(null);

  // Each preview session starts from a fresh attempt.
  useEffect(() => {
    if (open) {
      setLastResult(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Preview exercise</DialogTitle>
          <DialogDescription>
            {typeName} ({typeCode}). Assets are not previewed here; text and audio
            fallbacks are shown.
          </DialogDescription>
        </DialogHeader>
        <div dir="rtl">
          <ExercisePlayer
            typeCode={typeCode}
            configuration={configuration}
            onAnswer={setLastResult}
          />
        </div>
        {lastResult === null ? null : (
          <p
            className={
              lastResult.correct
                ? "text-sm font-medium text-emerald-700 dark:text-emerald-400"
                : "text-sm font-medium text-destructive"
            }
          >
            {lastResult.correct ? "Answer: correct ✓" : "Answer: incorrect"}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
