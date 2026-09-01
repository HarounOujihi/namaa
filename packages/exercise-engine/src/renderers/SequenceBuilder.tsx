import { useMemo, useState } from "react";
import { InstructionText } from "../ui.js";
import { useRevealPhase } from "../useRevealPhase.js";
import {
  optionImage,
  positionBadge,
  primaryButton,
  primaryButtonDisabled,
  sequenceCard,
  sequenceCardBack,
  sequenceCardSelected,
  sequenceCardText,
  sequenceGrid,
  stack,
} from "../styles.js";
import { assetUrl, shuffle, toArabicDigits } from "../utils.js";

/** A tappable card in a recall sequence (option spec resolved against assets). */
export interface SequenceCard {
  id: string;
  text?: string;
  imageUrl?: string;
}

export function toSequenceCards(
  items: readonly { id: string; text?: string; imageAssetId?: string }[],
  assetUrls: Record<string, string> | undefined,
): SequenceCard[] {
  return items.map((item) => ({
    id: item.id,
    text: item.text,
    imageUrl: assetUrl(assetUrls, item.imageAssetId),
  }));
}

function CardFace({ card }: { card: SequenceCard }) {
  if (card.imageUrl !== undefined) {
    return <img src={card.imageUrl} alt="" style={optionImage} />;
  }
  return (
    <span style={sequenceCardText}>
      {card.text !== undefined && card.text.length > 0 ? card.text : "؟"}
    </span>
  );
}

/**
 * Tap-to-order interaction shared by ORDERING and MEMORY_GAME: first tap takes
 * the first position, tapping a selected card undoes it, and the big check
 * button submits once the whole sequence is placed. Face-down decks flip a
 * card the moment it joins the sequence.
 */
export function SequenceBuilder({
  cards,
  faceDown,
  locked,
  onSubmit,
}: {
  cards: readonly SequenceCard[];
  faceDown: boolean;
  locked: boolean;
  onSubmit: (itemIds: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const complete = selected.length === cards.length;

  const toggle = (id: string): void => {
    if (locked) {
      return;
    }
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };

  return (
    <div style={stack}>
      <div style={sequenceGrid}>
        {cards.map((card) => {
          const index = selected.indexOf(card.id);
          const isSelected = index >= 0;
          return (
            <button
              key={card.id}
              type="button"
              aria-pressed={isSelected}
              style={isSelected ? sequenceCardSelected : sequenceCard}
              onClick={() => toggle(card.id)}
            >
              {isSelected ? (
                <span style={positionBadge} aria-hidden>
                  {toArabicDigits(index + 1)}
                </span>
              ) : null}
              {isSelected || !faceDown ? (
                <CardFace card={card} />
              ) : (
                <span style={sequenceCardBack} aria-hidden>
                  ؟
                </span>
              )}
            </button>
          );
        })}
      </div>
      <InstructionText>
        {complete
          ? "رتبت كل البطاقات، اضغط «تحقق»"
          : `اضغط البطاقات بالترتيب (${toArabicDigits(selected.length)} من ${toArabicDigits(cards.length)})`}
      </InstructionText>
      <button
        type="button"
        style={complete && !locked ? primaryButton : primaryButtonDisabled}
        disabled={!complete || locked}
        onClick={() => {
          if (complete && !locked) {
            onSubmit(selected);
          }
        }}
      >
        تحقق
      </button>
    </div>
  );
}

/**
 * Visual-memory flow: the cards stay face-up in TARGET order (numbered, with a
 * countdown) for `displaySeconds`, then flip and shuffle for recall.
 */
export function RevealRecall({
  cards,
  displaySeconds,
  locked,
  onSubmit,
}: {
  cards: readonly SequenceCard[];
  displaySeconds: number;
  locked: boolean;
  onSubmit: (itemIds: string[]) => void;
}) {
  const { phase, secondsLeft } = useRevealPhase(displaySeconds);
  const shuffled = useMemo(() => shuffle(cards), [cards]);

  if (phase === "reveal") {
    return (
      <div style={stack}>
        <InstructionText>انظر جيدًا واحفظ الترتيب… {toArabicDigits(secondsLeft)}</InstructionText>
        <div style={sequenceGrid}>
          {cards.map((card, index) => (
            <div key={card.id} style={{ ...sequenceCard, cursor: "default" }}>
              <span style={positionBadge} aria-hidden>
                {toArabicDigits(index + 1)}
              </span>
              <CardFace card={card} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={stack}>
      <InstructionText>الآن اضغط البطاقات بالترتيب الذي رأيته</InstructionText>
      <SequenceBuilder cards={shuffled} faceDown locked={locked} onSubmit={onSubmit} />
    </div>
  );
}
