import { useId } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { SimpleSelect, type SelectOption } from "@/components/simple-select";
import {
  ConfigSection,
  FieldRow,
  OptionListEditor,
  TextAudioPairField,
  type VisualEditorProps,
} from "./fields";
import {
  asRecord,
  asRecordArray,
  asString,
  pickEnum,
  withKey,
} from "./config-helpers";

const PIECE_KIND_OPTIONS: readonly SelectOption[] = [
  { value: "letter", label: "Letters" },
  { value: "syllable", label: "Syllables" },
];

export function WordBuilderEditor({ configuration, onChange }: VisualEditorProps) {
  const targetWordId = useId();
  const pieceKindId = useId();
  const targetWord = asString(configuration.targetWord);
  const pieceKind = pickEnum(configuration.pieceKind, ["letter", "syllable"] as const);
  const pieces = asRecordArray(configuration.pieces);
  const distractors = asRecordArray(configuration.distractors);
  const audio = asRecord(configuration.audio);
  const joined = pieces.map((piece) => asString(piece.text)).join("");
  const piecesMatch = targetWord !== "" && joined === targetWord;

  return (
    <div className="grid gap-5">
      <ConfigSection title="Target word">
        <div className="grid gap-3">
          <FieldRow label="Target word" htmlFor={targetWordId}>
            <Input
              id={targetWordId}
              dir="rtl"
              className="text-right"
              value={targetWord}
              placeholder="e.g. قلم"
              onChange={(event) => onChange({ ...configuration, targetWord: event.target.value })}
            />
          </FieldRow>
          <FieldRow
            label="Piece kind"
            htmlFor={pieceKindId}
            hint="What the child drags into the slots."
          >
            <SimpleSelect
              id={pieceKindId}
              value={pieceKind}
              onValueChange={(value) => onChange(withKey(configuration, "pieceKind", value))}
              options={PIECE_KIND_OPTIONS}
              placeholder="Letters or syllables?"
            />
          </FieldRow>
          <p
            role="status"
            className={cn(
              "text-xs font-medium",
              piecesMatch ? "text-green-600 dark:text-green-400" : "text-destructive",
            )}
          >
            {piecesMatch
              ? `✓ Pieces spell the target word (${joined})`
              : `✗ Pieces spell “${joined}” — expected “${targetWord}”`}
          </p>
        </div>
      </ConfigSection>
      <OptionListEditor
        title="Pieces"
        hint="In TARGET order — joined left to right they must spell the target word."
        itemNoun="piece"
        idPrefix="p"
        addLabel="Add piece"
        items={pieces}
        onChange={(next) => onChange({ ...configuration, pieces: next })}
        emptyHint="No pieces yet — add them in target order."
      />
      <OptionListEditor
        title="Distractors"
        hint="Optional decoy pieces shuffled into the pool."
        itemNoun="distractor"
        idPrefix="d"
        addLabel="Add distractor"
        items={distractors}
        onChange={(next) => onChange({ ...configuration, distractors: next })}
        emptyHint="No distractors — the pool is exactly the target pieces."
      />
      <ConfigSection title="Audio" hint="The word, read aloud when a slot fills or on request.">
        <TextAudioPairField
          textLabel="Read-aloud text"
          audioLabel="Read-aloud audio"
          value={audio}
          onChange={(next) => onChange({ ...configuration, audio: next })}
          textPlaceholder="The word, e.g. قلم"
        />
      </ConfigSection>
    </div>
  );
}
