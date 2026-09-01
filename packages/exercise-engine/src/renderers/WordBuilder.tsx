import { useEffect, useMemo, useState } from "react";
import type { WordBuilderConfig } from "@dyslexia/exercise-core";
import type { RendererProps } from "../contract.js";
import { InstructionText, PlaySoundButton } from "../ui.js";
import { speakArabic, speakDelayed } from "../speech.js";
import { instructionText, poolGrid, poolTile, poolTileUsed, promptCard, slotTile, slotsRow, stack } from "../styles.js";
import { assetUrl, shuffle } from "../utils.js";

/** Build the word by tapping pieces into ordered slots; auto-submits when full. */
export function WordBuilder({ configuration, assetUrls, locked, onSubmit }: RendererProps<WordBuilderConfig>) {
  const audioUrl = assetUrl(assetUrls, configuration.audio.audioAssetId);
  const [slots, setSlots] = useState<(string | null)[]>(() => configuration.pieces.map(() => null));

  const pool = useMemo(
    () => shuffle([...configuration.pieces, ...(configuration.distractors ?? [])]),
    [configuration],
  );
  const textById = useMemo(() => {
    const map = new Map<string, string>();
    for (const piece of configuration.pieces) {
      map.set(piece.id, piece.text);
    }
    for (const distractor of configuration.distractors ?? []) {
      map.set(distractor.id, distractor.text);
    }
    return map;
  }, [configuration]);

  // Read the target word aloud once (after the host instructions).
  useEffect(() => {
    if (audioUrl === undefined) {
      return speakDelayed([configuration.audio.text]);
    }
    return undefined;
  }, [audioUrl, configuration.audio.text]);

  const allFilled = slots.every((slot) => slot !== null);

  useEffect(() => {
    if (!allFilled || locked) {
      return;
    }
    onSubmit({ kind: "word", pieceIds: slots.filter((slot): slot is string => slot !== null) });
  }, [allFilled, locked, onSubmit, slots]);

  const placePiece = (pieceId: string): void => {
    if (locked || slots.includes(pieceId)) {
      return;
    }
    const nextEmpty = slots.indexOf(null);
    if (nextEmpty < 0) {
      return;
    }
    const next = [...slots];
    next[nextEmpty] = pieceId;
    setSlots(next);
    const pieceText = textById.get(pieceId);
    if (pieceText !== undefined) {
      speakArabic(pieceText);
    }
  };

  const removePiece = (index: number): void => {
    if (locked) {
      return;
    }
    const next = [...slots];
    next[index] = null;
    setSlots(next);
  };

  return (
    <section style={stack}>
      <InstructionText>استمع للكلمة ثم ابنِها من القطع</InstructionText>
      <div style={{ ...promptCard, flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 16 }}>
        <PlaySoundButton audioUrl={audioUrl} ttsText={configuration.audio.text} label="استمع إلى الكلمة" />
        <p style={{ ...instructionText, alignSelf: "center", margin: 0 }}>
          اضغط قطعة لملء الفراغ التالي، واضغط فراغًا ممتلئًا لإعادة القطعة
        </p>
      </div>
      <div style={slotsRow}>
        {slots.map((pieceId, index) => (
          <button
            key={index}
            type="button"
            style={slotTile}
            disabled={locked || pieceId === null}
            aria-label={pieceId === null ? "فراغ" : "أعد القطعة إلى الأسفل"}
            onClick={() => removePiece(index)}
          >
            {pieceId !== null ? textById.get(pieceId) ?? "" : "•"}
          </button>
        ))}
      </div>
      <div style={poolGrid}>
        {pool.map((piece) => {
          const used = slots.includes(piece.id);
          return (
            <button
              key={piece.id}
              type="button"
              style={used ? poolTileUsed : poolTile}
              disabled={locked || used}
              onClick={() => placePiece(piece.id)}
            >
              {piece.text}
            </button>
          );
        })}
      </div>
    </section>
  );
}
