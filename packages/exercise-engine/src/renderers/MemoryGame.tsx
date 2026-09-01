import { useMemo } from "react";
import type { MemoryGameConfig } from "@dyslexia/exercise-core";
import type { RendererProps } from "../contract.js";
import { InstructionText } from "../ui.js";
import { stack } from "../styles.js";
import { RevealRecall, toSequenceCards } from "./SequenceBuilder.js";

/** Cards shown briefly in target order, then reproduced from memory. */
export function MemoryGame({ configuration, assetUrls, locked, onSubmit }: RendererProps<MemoryGameConfig>) {
  const cards = useMemo(() => toSequenceCards(configuration.cards, assetUrls), [configuration, assetUrls]);

  return (
    <section style={stack}>
      <InstructionText>احفظ ترتيب البطاقات، ثم أعده بالضغط عليها</InstructionText>
      <RevealRecall
        cards={cards}
        displaySeconds={configuration.displaySeconds}
        locked={locked}
        onSubmit={(itemIds) => onSubmit({ kind: "order", itemIds })}
      />
    </section>
  );
}
