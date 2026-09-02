import { useId } from "react";
import { SimpleSelect, type SelectOption } from "@/components/simple-select";
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
  pickEnum,
  withKey,
  type ConfigRecord,
} from "./config-helpers";

const CUE_STYLE_OPTIONS: readonly SelectOption[] = [
  { value: "none", label: "None" },
  { value: "dots", label: "Dots" },
];

export function ImageMatchEditor({ configuration, onChange }: VisualEditorProps) {
  const cueStyleId = useId();
  const prompt = asRecord(configuration.prompt);
  const options = asRecordArray(configuration.options);
  const correctOptionId = optionalId(configuration.correctOptionId);
  const cueStyle = pickEnum(configuration.cueStyle, ["none", "dots"] as const);

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
        hint="2–6 close-looking letters or words."
        items={options}
        onChange={setOptions}
        canMarkCorrect
        correctId={correctOptionId ?? null}
        onCorrectChange={(id) => onChange({ ...configuration, correctOptionId: id })}
      />
      <ConfigSection title="Cue style">
        <FieldRow
          label="Cue style"
          htmlFor={cueStyleId}
          hint="“dots” shows dot-count cues for similar letters (ب ت ث)."
        >
          <SimpleSelect
            id={cueStyleId}
            value={cueStyle}
            onValueChange={(value) => onChange(withKey(configuration, "cueStyle", value))}
            options={CUE_STYLE_OPTIONS}
            placeholder="Select cue style"
          />
        </FieldRow>
      </ConfigSection>
    </div>
  );
}
