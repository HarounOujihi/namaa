import { useId, useState, type ReactNode } from "react";
import { AssetLibraryDialog } from "@/components/asset-library-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ImageIcon,
  PlusIcon,
  Volume2Icon,
  XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AssetType } from "@/types";
import { assetDisplayName, rememberAssets } from "./asset-labels";
import {
  asString,
  nextSequentialId,
  optionalId,
  parseOptionalNumberText,
  withKey,
  withOptionalText,
  type ConfigRecord,
} from "./config-helpers";

export interface VisualEditorProps {
  configuration: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

/** Section caption used across editors ("Prompt", "Options", …). */
export function ConfigSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <div className="grid gap-0.5">
        <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {title}
        </h4>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** Label + control row; `htmlFor` renders a real <label>, otherwise a plain span. */
export function FieldRow({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      {htmlFor ? (
        <Label htmlFor={htmlFor} className="text-muted-foreground">
          {label}
        </Label>
      ) : (
        <span className="text-sm leading-none font-medium text-muted-foreground">{label}</span>
      )}
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

interface AssetFieldProps {
  label: string;
  assetId: string | undefined;
  onChange: (assetId: string | undefined) => void;
}

function AssetField({
  label,
  assetId,
  onChange,
  assetType,
  dialogTitle,
}: AssetFieldProps & { assetType: AssetType; dialogTitle: string }) {
  const [open, setOpen] = useState(false);
  const knownName = assetDisplayName(assetId);
  return (
    <FieldRow label={label}>
      <div className="flex items-center gap-1.5">
        <span className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border bg-muted/40 px-2 py-1 text-sm">
          {assetType === "AUDIO" ? (
            <Volume2Icon className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ImageIcon className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          {assetId === undefined ? (
            <span className="text-muted-foreground">none</span>
          ) : (
            <span className="truncate" title={assetId}>
              {knownName ?? assetId}
            </span>
          )}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => setOpen(true)}
        >
          Choose from library
        </Button>
        {assetId !== undefined ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
            aria-label={`Clear ${label.toLowerCase()}`}
            onClick={() => onChange(undefined)}
          >
            <XIcon />
          </Button>
        ) : null}
      </div>
      <AssetLibraryDialog
        open={open}
        onOpenChange={setOpen}
        type={assetType}
        title={dialogTitle}
        onSelect={(assets) => {
          const picked = assets[0];
          if (picked) {
            rememberAssets(assets);
            onChange(picked.id);
          }
        }}
      />
    </FieldRow>
  );
}

/** Picks an AUDIO asset into a sibling `audioAssetId`-style key. */
export function AudioAssetField(props: AssetFieldProps) {
  return <AssetField {...props} assetType="AUDIO" dialogTitle="Pick audio" />;
}

/** Picks an IMAGE asset into a sibling `imageAssetId`-style key. */
export function ImageAssetField(props: AssetFieldProps) {
  return <AssetField {...props} assetType="IMAGE" dialogTitle="Pick an image" />;
}

/** Prompt spec: `{ text?, imageAssetId?, audioAssetId? }` — three simple rows. */
export function PromptFields({
  prompt,
  onChange,
  title = "Prompt",
}: {
  prompt: ConfigRecord;
  onChange: (next: ConfigRecord) => void;
  title?: string;
}) {
  const textId = useId();
  return (
    <ConfigSection title={title} hint="Rendered as audio if present, else image, else text.">
      <div className="grid gap-3">
        <FieldRow label="Text" htmlFor={textId}>
          <Input
            id={textId}
            dir="rtl"
            className="text-right"
            value={asString(prompt.text)}
            placeholder="Arabic prompt text (also the TTS fallback)"
            onChange={(event) => onChange(withOptionalText(prompt, "text", event.target.value))}
          />
        </FieldRow>
        <div className="grid gap-3 sm:grid-cols-2">
          <ImageAssetField
            label="Image"
            assetId={optionalId(prompt.imageAssetId)}
            onChange={(imageAssetId) => onChange(withKey(prompt, "imageAssetId", imageAssetId))}
          />
          <AudioAssetField
            label="Audio"
            assetId={optionalId(prompt.audioAssetId)}
            onChange={(audioAssetId) => onChange(withKey(prompt, "audioAssetId", audioAssetId))}
          />
        </div>
      </div>
    </ConfigSection>
  );
}

/** A `{ text, audioAssetId? }` pair — words and read-aloud lines across types. */
export function TextAudioPairField({
  textLabel,
  audioLabel,
  value,
  onChange,
  textPlaceholder,
}: {
  textLabel: string;
  audioLabel: string;
  value: ConfigRecord;
  onChange: (next: ConfigRecord) => void;
  textPlaceholder?: string;
}) {
  const textId = useId();
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <FieldRow label={textLabel} htmlFor={textId}>
        <Input
          id={textId}
          dir="rtl"
          className="text-right"
          value={asString(value.text)}
          placeholder={textPlaceholder}
          onChange={(event) => onChange({ ...value, text: event.target.value })}
        />
      </FieldRow>
      <AudioAssetField
        label={audioLabel}
        assetId={optionalId(value.audioAssetId)}
        onChange={(audioAssetId) => onChange(withKey(value, "audioAssetId", audioAssetId))}
      />
    </div>
  );
}

export interface OptionListEditorProps {
  items: ConfigRecord[];
  onChange: (next: ConfigRecord[]) => void;
  title: string;
  hint?: string;
  addLabel?: string;
  itemNoun?: string;
  idPrefix?: string;
  showText?: boolean;
  showImage?: boolean;
  showAudio?: boolean;
  canMarkCorrect?: boolean;
  correctId?: string | null;
  onCorrectChange?: (id: string) => void;
  emptyHint?: string;
}

/** Repeater for options / items / cards / pieces arrays (`{ id, text?, imageAssetId?, audioAssetId? }`). */
export function OptionListEditor({
  items,
  onChange,
  title,
  hint,
  addLabel = "Add option",
  itemNoun = "option",
  idPrefix = "o",
  showText = true,
  showImage = false,
  showAudio = false,
  canMarkCorrect = false,
  correctId = null,
  onCorrectChange,
  emptyHint,
}: OptionListEditorProps) {
  const radioName = useId();

  function updateItem(index: number, nextItem: ConfigRecord): void {
    onChange(items.map((item, i) => (i === index ? nextItem : item)));
  }

  function moveItem(index: number, offset: -1 | 1): void {
    const target = index + offset;
    if (target < 0 || target >= items.length) {
      return;
    }
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    onChange(next);
  }

  return (
    <ConfigSection title={title} hint={hint}>
      <div className="grid gap-2">
        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
            {emptyHint ?? `No ${itemNoun}s yet.`}
          </p>
        ) : (
          <ol className="grid gap-2">
            {items.map((item, index) => {
              const id = asString(item.id);
              const rowName = id === "" ? `row ${index + 1}` : id;
              const isCorrect = canMarkCorrect && id !== "" && id === correctId;
              return (
                <li key={id === "" ? index : id} className="grid gap-2 rounded-lg border p-2.5">
                  <div className="flex items-center gap-2">
                    {canMarkCorrect ? (
                      <input
                        type="radio"
                        name={radioName}
                        checked={isCorrect}
                        onChange={() => {
                          if (id !== "") {
                            onCorrectChange?.(id);
                          }
                        }}
                        aria-label={`Mark ${rowName} as the correct ${itemNoun}`}
                        className="size-4 shrink-0 accent-[var(--primary)]"
                      />
                    ) : null}
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                      {id === "" ? "—" : id}
                    </code>
                    <div className="ml-auto flex items-center gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Move ${rowName} up`}
                        disabled={index === 0}
                        onClick={() => moveItem(index, -1)}
                      >
                        <ChevronUpIcon />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Move ${rowName} down`}
                        disabled={index === items.length - 1}
                        onClick={() => moveItem(index, 1)}
                      >
                        <ChevronDownIcon />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Remove ${rowName}`}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => onChange(items.filter((_, i) => i !== index))}
                      >
                        <XIcon />
                      </Button>
                    </div>
                  </div>
                  {showText ? (
                    <Input
                      dir="rtl"
                      className="text-right"
                      value={asString(item.text)}
                      placeholder={`${itemNoun} text`}
                      aria-label={`${rowName} text`}
                      onChange={(event) =>
                        updateItem(index, withOptionalText(item, "text", event.target.value))
                      }
                    />
                  ) : null}
                  {showImage || showAudio ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {showImage ? (
                        <ImageAssetField
                          label="Image"
                          assetId={optionalId(item.imageAssetId)}
                          onChange={(imageAssetId) =>
                            updateItem(index, withKey(item, "imageAssetId", imageAssetId))
                          }
                        />
                      ) : null}
                      {showAudio ? (
                        <AudioAssetField
                          label="Audio"
                          assetId={optionalId(item.audioAssetId)}
                          onChange={(audioAssetId) =>
                            updateItem(index, withKey(item, "audioAssetId", audioAssetId))
                          }
                        />
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange([...items, { id: nextSequentialId(items, idPrefix) }])}
          >
            <PlusIcon />
            {addLabel}
          </Button>
        </div>
      </div>
    </ConfigSection>
  );
}

/** Optional whole-number field; clearing removes the key from the JSON. */
export function NumberField({
  label,
  value,
  onChange,
  min,
  hint,
  placeholder,
}: {
  label: string;
  value: number | undefined;
  onChange: (next: number | undefined) => void;
  min?: number;
  hint?: string;
  placeholder?: string;
}) {
  const inputId = useId();
  return (
    <FieldRow label={label} htmlFor={inputId} hint={hint}>
      <Input
        id={inputId}
        type="number"
        min={min}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(event) => onChange(parseOptionalNumberText(event.target.value, min))}
      />
    </FieldRow>
  );
}

/** Inline radios for a small enum (e.g. beginning / middle / end). */
export function InlineRadioGroup({
  label,
  value,
  choices,
  onChange,
}: {
  label: string;
  value: string | null;
  choices: readonly { value: string; label: string }[];
  onChange: (next: string) => void;
}) {
  const name = useId();
  return (
    <div className="grid gap-1.5">
      <span className="text-sm leading-none font-medium text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5" role="radiogroup" aria-label={label}>
        {choices.map((choice) => (
          <label key={choice.value} className="flex cursor-pointer items-center gap-1.5 text-sm">
            <input
              type="radio"
              name={name}
              checked={value === choice.value}
              onChange={() => onChange(choice.value)}
              className="size-4 accent-[var(--primary)]"
            />
            {choice.label}
          </label>
        ))}
      </div>
    </div>
  );
}

/** Two-button toggle for a mode choice (e.g. AUDIO_MATCH modes). */
export function SegmentedToggle<T extends string>({
  value,
  choices,
  onSelect,
  ariaLabel,
}: {
  value: T | null;
  choices: readonly { value: T; label: string }[];
  onSelect: (next: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex w-fit gap-0.5 rounded-lg border bg-muted/40 p-0.5"
    >
      {choices.map((choice) => (
        <Button
          key={choice.value}
          type="button"
          size="xs"
          variant={value === choice.value ? "default" : "ghost"}
          onClick={() => onSelect(choice.value)}
        >
          {choice.label}
        </Button>
      ))}
    </div>
  );
}
