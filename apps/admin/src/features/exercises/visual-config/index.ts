import { createElement, type ReactElement } from "react";
import { AudioMatchEditor } from "./audio-match-editor";
import { ImageMatchEditor } from "./image-match-editor";
import { MemoryGameEditor } from "./memory-game-editor";
import { MultipleChoiceEditor } from "./multiple-choice-editor";
import { OrderingEditor } from "./ordering-editor";
import { SoundPositionEditor } from "./sound-position-editor";
import type { VisualEditorProps } from "./fields";
import { WordBuilderEditor } from "./word-builder-editor";

type EditorComponent = (props: VisualEditorProps) => ReactElement;

/** Static registry of the first-wave exercise types that have a visual editor. */
const EDITORS: Record<string, EditorComponent> = {
  MULTIPLE_CHOICE: MultipleChoiceEditor,
  IMAGE_MATCH: ImageMatchEditor,
  AUDIO_MATCH: AudioMatchEditor,
  SOUND_POSITION: SoundPositionEditor,
  ORDERING: OrderingEditor,
  WORD_BUILDER: WordBuilderEditor,
  MEMORY_GAME: MemoryGameEditor,
};

export interface VisualConfigEditorProps {
  typeCode: string;
  configuration: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

export function hasVisualEditor(typeCode: string): boolean {
  return Object.hasOwn(EDITORS, typeCode);
}

/** Renders the visual editor for the exercise type, or null when there is none. */
export function VisualConfigEditor({
  typeCode,
  configuration,
  onChange,
}: VisualConfigEditorProps): ReactElement | null {
  const Editor = Object.hasOwn(EDITORS, typeCode) ? EDITORS[typeCode] : undefined;
  return Editor === undefined ? null : createElement(Editor, { configuration, onChange });
}
