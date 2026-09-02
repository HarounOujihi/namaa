import {
  ConfigSection,
  NumberField,
  OptionListEditor,
  type VisualEditorProps,
} from "./fields";
import { asNumber, asRecordArray, withKey } from "./config-helpers";

export function MemoryGameEditor({ configuration, onChange }: VisualEditorProps) {
  const cards = asRecordArray(configuration.cards);

  return (
    <div className="grid gap-5">
      <ConfigSection
        title="Task"
        hint="Reorder — the cards are shown briefly, then the child reproduces the order. (“match_pairs” is reserved for a later version.)"
      />
      <OptionListEditor
        title="Cards"
        hint="3–8 cards, in target order — each card shows its text or its image."
        itemNoun="card"
        idPrefix="c"
        addLabel="Add card"
        items={cards}
        onChange={(next) => onChange({ ...configuration, cards: next })}
        showImage
        emptyHint="No cards yet — add 3–8 in the order the child must reproduce."
      />
      <ConfigSection title="Display">
        <NumberField
          label="Display seconds"
          value={asNumber(configuration.displaySeconds)}
          onChange={(displaySeconds) =>
            onChange(withKey(configuration, "displaySeconds", displaySeconds))
          }
          min={1}
          hint="How long the cards stay visible (default 5)."
        />
      </ConfigSection>
    </div>
  );
}
