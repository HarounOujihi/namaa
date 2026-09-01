import { useEffect, useMemo } from "react";
import type { OrderingConfig } from "@dyslexia/exercise-core";
import type { RendererProps } from "../contract.js";
import { InstructionText } from "../ui.js";
import { speakDelayed } from "../speech.js";
import { playSoundSequence } from "../audio.js";
import { primaryButton, stack } from "../styles.js";
import { assetUrl, shuffle } from "../utils.js";
import { RevealRecall, SequenceBuilder, toSequenceCards } from "./SequenceBuilder.js";

/** Reproduce a sequence: heard in order (auditory memory) or seen then hidden. */
export function Ordering(props: RendererProps<OrderingConfig>) {
  if (props.configuration.presentation === "sequential_audio") {
    return <SequentialAudioOrdering {...props} configuration={props.configuration} />;
  }
  const cards = toSequenceCards(props.configuration.items, props.assetUrls);
  return (
    <section style={stack}>
      <InstructionText>تأمل البطاقات جيدًا، ثم رتّبها بالترتيب نفسه بعد اختفائها</InstructionText>
      <RevealRecall
        cards={cards}
        displaySeconds={props.configuration.displaySeconds ?? 5}
        locked={props.locked}
        onSubmit={(itemIds) => props.onSubmit({ kind: "order", itemIds })}
      />
    </section>
  );
}

/** Play button speaks the items in target order; the child then taps them from memory. */
function SequentialAudioOrdering({ configuration, assetUrls, locked, onSubmit }: RendererProps<OrderingConfig>) {
  const sources = useMemo(
    () =>
      configuration.items.map((item) => ({
        audioUrl: assetUrl(assetUrls, item.audioAssetId),
        text: item.text,
      })),
    [configuration, assetUrls],
  );
  const cards = useMemo(
    () => shuffle(toSequenceCards(configuration.items, assetUrls)),
    [configuration, assetUrls],
  );

  // One free listening pass after the instructions (TTS only when no audio assets).
  useEffect(() => {
    if (sources.every((source) => source.audioUrl === undefined)) {
      return speakDelayed(sources.map((source) => source.text ?? ""));
    }
    return undefined;
  }, [sources]);

  return (
    <section style={stack}>
      <InstructionText>استمع جيدًا، ثم اضغط الكلمات بالترتيب نفسه الذي سمعته</InstructionText>
      <button type="button" style={primaryButton} onClick={() => playSoundSequence(sources)}>
        🔊 استمع للترتيب
      </button>
      <SequenceBuilder
        cards={cards}
        faceDown={false}
        locked={locked}
        onSubmit={(itemIds) => onSubmit({ kind: "order", itemIds })}
      />
    </section>
  );
}
