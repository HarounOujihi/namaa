import { useId } from "react";
import { Input } from "@/components/ui/input";
import {
  ConfigSection,
  FieldRow,
  OptionListEditor,
  PromptFields,
  type VisualEditorProps,
} from "./fields";
import {
  asRecord,
  asRecordArray,
  asString,
  optionalId,
  withOptionalText,
  type ConfigRecord,
} from "./config-helpers";

export function MultipleChoiceEditor({ configuration, onChange }: VisualEditorProps) {
  const feedbackId = useId();
  const prompt = asRecord(configuration.prompt);
  const options = asRecordArray(configuration.options);
  const correctOptionId = optionalId(configuration.correctOptionId);

  function setOptions(next: ConfigRecord[]): void {
    const keepCorrect =
      correctOptionId !== undefined && next.some((item) => asString(item.id) === correctOptionId);
    onChange({
      ...configuration,
      options: next,
      correctOptionId: keepCorrect ? correctOptionId : undefined,
    });
  }

  return (
    <div className="grid gap-5">
      <PromptFields
        prompt={prompt}
        onChange={(next) => onChange({ ...configuration, prompt: next })}
      />
      <OptionListEditor
        title="Options"
        hint="2–6 options; exactly one is correct."
        items={options}
        onChange={setOptions}
        canMarkCorrect
        correctId={correctOptionId ?? null}
        onCorrectChange={(id) => onChange({ ...configuration, correctOptionId: id })}
      />
      <ConfigSection title="Feedback">
        <FieldRow
          label="Feedback text"
          htmlFor={feedbackId}
          hint="Positive closing line shown after the answer."
        >
          <Input
            id={feedbackId}
            dir="rtl"
            className="text-right"
            value={asString(configuration.feedbackText)}
            placeholder="أحسنت!"
            onChange={(event) =>
              onChange(withOptionalText(configuration, "feedbackText", event.target.value))
            }
          />
        </FieldRow>
      </ConfigSection>
    </div>
  );
}
