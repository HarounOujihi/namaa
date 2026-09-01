import type { MultipleChoiceConfig } from "@dyslexia/exercise-core";
import type { RendererProps } from "../contract.js";
import { OptionButton, PromptView } from "../ui.js";
import { optionGrid, stack } from "../styles.js";

/** Prompt → pick one option; tap is the answer. */
export function MultipleChoice({ configuration, assetUrls, locked, onSubmit }: RendererProps<MultipleChoiceConfig>) {
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
          />
        ))}
      </div>
    </section>
  );
}
