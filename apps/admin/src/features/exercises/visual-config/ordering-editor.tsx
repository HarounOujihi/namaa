import { useId } from "react";
import { SimpleSelect, type SelectOption } from "@/components/simple-select";
import {
  ConfigSection,
  FieldRow,
  NumberField,
  OptionListEditor,
  type VisualEditorProps,
} from "./fields";
import {
  asNumber,
  asRecordArray,
  pickEnum,
  withKey,
} from "./config-helpers";

const PRESENTATION_OPTIONS: readonly SelectOption[] = [
  { value: "sequential_audio", label: "Sequential audio" },
  { value: "visual", label: "Visual cards" },
];

export function OrderingEditor({ configuration, onChange }: VisualEditorProps) {
  const presentationId = useId();
  const presentation = pickEnum(configuration.presentation, [
    "sequential_audio",
    "visual",
  ] as const);
  const items = asRecordArray(configuration.items);

  return (
    <div className="grid gap-5">
      <ConfigSection title="Presentation">
        <div className="grid gap-3">
          <FieldRow
            label="Presentation"
            htmlFor={presentationId}
            hint="“Sequential audio” plays the items in order; “visual” shows the cards, then hides them."
          >
            <SimpleSelect
              id={presentationId}
              value={presentation}
              onValueChange={(value) => onChange(withKey(configuration, "presentation", value))}
              options={PRESENTATION_OPTIONS}
              placeholder="How is the sequence shown?"
            />
          </FieldRow>
          <NumberField
            label="Display seconds"
            value={asNumber(configuration.displaySeconds)}
            onChange={(displaySeconds) =>
              onChange(withKey(configuration, "displaySeconds", displaySeconds))
            }
            min={1}
            hint="For “visual” presentation — how long the cards stay visible (default 5)."
          />
        </div>
      </ConfigSection>
      <OptionListEditor
        title="Items"
        hint="2–8 items, in TARGET order."
        itemNoun="item"
        addLabel="Add item"
        items={items}
        onChange={(next) => onChange({ ...configuration, items: next })}
        showAudio
        emptyHint="No items yet — add 2–8 in the order the child must reproduce."
      />
    </div>
  );
}
