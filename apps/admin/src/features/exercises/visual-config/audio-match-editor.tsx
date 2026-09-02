import { useId } from "react";
import { SimpleSelect, type SelectOption } from "@/components/simple-select";
import {
  ConfigSection,
  FieldRow,
  ImageAssetField,
  OptionListEditor,
  SegmentedToggle,
  TextAudioPairField,
  type VisualEditorProps,
} from "./fields";
import {
  asRecord,
  asRecordArray,
  asString,
  dropKeys,
  optionalId,
  pickEnum,
  withKey,
  type ConfigRecord,
} from "./config-helpers";

type AudioMatchMode = "pair_comparison" | "sound_to_image";

const MODE_CHOICES: readonly { value: AudioMatchMode; label: string }[] = [
  { value: "pair_comparison", label: "Pair comparison" },
  { value: "sound_to_image", label: "Sound → image" },
];

const QUESTION_OPTIONS: readonly SelectOption[] = [
  { value: "same_first_sound", label: "Same first sound?" },
  { value: "same_word", label: "Same word?" },
];

const PAIR_CORRECT_OPTIONS: readonly SelectOption[] = [
  { value: "same", label: "Same" },
  { value: "different", label: "Different" },
];

const PAIR_ONLY_KEYS = [
  "wordA",
  "wordB",
  "promptImageAssetIdA",
  "promptImageAssetIdB",
  "question",
  "correct",
] as const;

const SOUND_TO_IMAGE_ONLY_KEYS = ["target", "options", "correctOptionId"] as const;

export function AudioMatchEditor({ configuration, onChange }: VisualEditorProps) {
  const questionId = useId();
  const correctIdInput = useId();
  const mode =
    pickEnum<AudioMatchMode>(configuration.mode, ["pair_comparison", "sound_to_image"]) ??
    "pair_comparison";

  function switchMode(next: AudioMatchMode): void {
    if (next === mode) {
      return;
    }
    const base = dropKeys(
      configuration,
      next === "pair_comparison" ? SOUND_TO_IMAGE_ONLY_KEYS : PAIR_ONLY_KEYS,
    );
    onChange({ ...base, mode: next });
  }

  const modeToggle = (
    <ConfigSection title="Mode">
      <SegmentedToggle
        ariaLabel="Audio match mode"
        value={mode}
        choices={MODE_CHOICES}
        onSelect={switchMode}
      />
    </ConfigSection>
  );

  if (mode === "sound_to_image") {
    const target = asRecord(configuration.target);
    const options = asRecordArray(configuration.options);
    const correctOptionId = optionalId(configuration.correctOptionId);

    function setOptions(next: ConfigRecord[]): void {
      const keepCorrect =
        correctOptionId !== undefined &&
        next.some((item) => asString(item.id) === correctOptionId);
      onChange({
        ...configuration,
        options: next,
        correctOptionId: keepCorrect ? correctOptionId : undefined,
      });
    }

    return (
      <div className="grid gap-5">
        {modeToggle}
        <ConfigSection title="Target sound" hint="Played aloud; the child picks its picture.">
          <TextAudioPairField
            textLabel="Target"
            audioLabel="Target audio"
            value={target}
            onChange={(next) => onChange({ ...configuration, target: next })}
            textPlaceholder="e.g. بطة"
          />
        </ConfigSection>
        <OptionListEditor
          title="Options"
          hint="2–6 pictures; exactly one is correct."
          items={options}
          onChange={setOptions}
          showImage
          canMarkCorrect
          correctId={correctOptionId ?? null}
          onCorrectChange={(id) => onChange({ ...configuration, correctOptionId: id })}
          emptyHint="No options yet — add 2–6 pictures."
        />
      </div>
    );
  }

  const wordA = asRecord(configuration.wordA);
  const wordB = asRecord(configuration.wordB);
  const question = pickEnum(configuration.question, ["same_first_sound", "same_word"] as const);
  const correct = pickEnum(configuration.correct, ["same", "different"] as const);

  return (
    <div className="grid gap-5">
      {modeToggle}
      <ConfigSection title="Word pair" hint="The two sounds the child compares.">
        <div className="grid gap-3">
          <TextAudioPairField
            textLabel="Word A"
            audioLabel="Word A audio"
            value={wordA}
            onChange={(next) => onChange({ ...configuration, wordA: next })}
            textPlaceholder="e.g. باب"
          />
          <TextAudioPairField
            textLabel="Word B"
            audioLabel="Word B audio"
            value={wordB}
            onChange={(next) => onChange({ ...configuration, wordB: next })}
            textPlaceholder="e.g. دب"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <ImageAssetField
              label="Prompt image A"
              assetId={optionalId(configuration.promptImageAssetIdA)}
              onChange={(promptImageAssetIdA) =>
                onChange(withKey(configuration, "promptImageAssetIdA", promptImageAssetIdA))
              }
            />
            <ImageAssetField
              label="Prompt image B"
              assetId={optionalId(configuration.promptImageAssetIdB)}
              onChange={(promptImageAssetIdB) =>
                onChange(withKey(configuration, "promptImageAssetIdB", promptImageAssetIdB))
              }
            />
          </div>
        </div>
      </ConfigSection>
      <ConfigSection title="Answer">
        <div className="grid gap-3 sm:grid-cols-2">
          <FieldRow label="Question" htmlFor={questionId}>
            <SimpleSelect
              id={questionId}
              value={question}
              onValueChange={(value) => onChange(withKey(configuration, "question", value))}
              options={QUESTION_OPTIONS}
              placeholder="What is the child asked?"
            />
          </FieldRow>
          <FieldRow label="Correct answer" htmlFor={correctIdInput}>
            <SimpleSelect
              id={correctIdInput}
              value={correct}
              onValueChange={(value) => onChange(withKey(configuration, "correct", value))}
              options={PAIR_CORRECT_OPTIONS}
              placeholder="Same or different?"
            />
          </FieldRow>
        </div>
      </ConfigSection>
    </div>
  );
}
