import { useId } from "react";
import { Input } from "@/components/ui/input";
import {
  ConfigSection,
  FieldRow,
  InlineRadioGroup,
  TextAudioPairField,
  type VisualEditorProps,
} from "./fields";
import { asRecord, asString, pickEnum, withKey } from "./config-helpers";

const POSITION_CHOICES = [
  { value: "beginning", label: "Beginning" },
  { value: "middle", label: "Middle" },
  { value: "end", label: "End" },
] as const;

export function SoundPositionEditor({ configuration, onChange }: VisualEditorProps) {
  const phonemeId = useId();
  const word = asRecord(configuration.word);
  const correctPosition = pickEnum(configuration.correctPosition, [
    "beginning",
    "middle",
    "end",
  ] as const);

  return (
    <div className="grid gap-5">
      <ConfigSection title="Word" hint="The word the child listens to.">
        <div className="grid gap-3">
          <TextAudioPairField
            textLabel="Word"
            audioLabel="Word audio"
            value={word}
            onChange={(next) => onChange({ ...configuration, word: next })}
            textPlaceholder="e.g. كتاب"
          />
          <FieldRow
            label="Target phoneme"
            htmlFor={phonemeId}
            hint="1–2 Arabic characters, e.g. ك."
          >
            <Input
              id={phonemeId}
              dir="rtl"
              className="text-right"
              maxLength={2}
              value={asString(configuration.targetPhoneme)}
              placeholder="ك"
              onChange={(event) =>
                onChange(withKey(configuration, "targetPhoneme", event.target.value))
              }
            />
          </FieldRow>
        </div>
      </ConfigSection>
      <ConfigSection title="Answer">
        <InlineRadioGroup
          label="Where does the phoneme fall?"
          value={correctPosition}
          choices={POSITION_CHOICES}
          onChange={(value) => onChange({ ...configuration, correctPosition: value })}
        />
      </ConfigSection>
    </div>
  );
}
