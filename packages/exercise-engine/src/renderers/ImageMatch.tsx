import { dotCount, lettersOf } from "@dyslexia/exercise-core";
import type { ImageMatchConfig } from "@dyslexia/exercise-core";
import type { RendererProps } from "../contract.js";
import { OptionButton, PromptView } from "../ui.js";
import { COLORS, optionGrid, stack } from "../styles.js";

/** Dot-count cue under a close-looking letter (ب=1 ت=2 ث=3) — Level-3 support. */
function DotCue({ text }: { text: string }) {
  const letter = lettersOf(text)[0] ?? text;
  const count = dotCount(letter);
  if (count <= 0) {
    return null;
  }
  return (
    <span aria-hidden style={{ display: "inline-flex", gap: 5 }}>
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          style={{ width: 12, height: 12, borderRadius: "50%", background: COLORS.primary }}
        />
      ))}
    </span>
  );
}

/** Visual discrimination: match a picture to its letter/word among close-looking options. */
export function ImageMatch({ configuration, assetUrls, locked, onSubmit }: RendererProps<ImageMatchConfig>) {
  const showDots = configuration.cueStyle === "dots";
  return (
    <section style={stack}>
      <PromptView prompt={configuration.prompt} assetUrls={assetUrls} />
      <div style={optionGrid}>
        {configuration.options.map((option) => (
          <OptionButton
            key={option.id}
            option={option}
            assetUrls={assetUrls}
            disabled={locked}
            onTap={(optionId) => onSubmit({ kind: "option", optionId })}
          >
            {showDots && option.text !== undefined ? <DotCue text={option.text} /> : null}
          </OptionButton>
        ))}
      </div>
    </section>
  );
}
