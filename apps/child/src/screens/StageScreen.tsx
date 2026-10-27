import type { ReactNode } from "react";
import type { PlayRecommendation, PlayStage, PlayStageItem } from "../types";
import { speak } from "../speech";
import { PageHeader } from "../components/PageHeader";

interface StageScreenProps {
  stage: PlayStage;
  /** Items completed this session (the server's `completed` flag covers earlier play). */
  completedItemIds: ReadonlySet<string>;
  /** The journey this stage belongs to (the header's back target). */
  parent: string;
  headerActions?: ReactNode;
  onOpenItem: (item: PlayStageItem) => void;
  recommendation: PlayRecommendation | null;
  onOpenRecommendation: (item: PlayStageItem) => void;
}

/** A picture per exercise type so the child can tell activities apart without reading. */
const TYPE_EMOJI: Record<string, string> = {
  MULTIPLE_CHOICE: "🔤",
  AUDIO_MATCH: "🎧",
  IMAGE_MATCH: "🖼️",
  ORDERING: "🔢",
  WORD_BUILDER: "🧩",
  SOUND_POSITION: "👂",
  MEMORY_GAME: "🃏",
};

/** The items of one roadmap stage as big activity cards. */
export function StageScreen({
  stage,
  completedItemIds,
  parent,
  headerActions,
  onOpenItem,
  recommendation,
  onOpenRecommendation,
}: StageScreenProps) {
  const items = stage.items.slice().sort((a, b) => a.order - b.order);
  const playable = items.filter((item) => item.exercise !== null);
  const doneCount = playable.filter((item) => item.completed || completedItemIds.has(item.id)).length;

  return (
    <main className="screen play-screen">
      <PageHeader title={stage.name} parent={parent} actions={headerActions} />

      {playable.length > 0 ? (
        <div className="stage-progress" aria-label={`أكملت ${doneCount} من ${playable.length}`}>
          <span className="stage-progress-text" aria-hidden="true">
            ✓ {doneCount} من {playable.length}
          </span>
          <span className="stage-progress-bar" aria-hidden="true">
            <span style={{ width: `${(doneCount / playable.length) * 100}%` }} />
          </span>
        </div>
      ) : null}

      {recommendation !== null && recommendation.exercise !== null ? (
        <button
          type="button"
          className="item-card recommendation"
          onClick={() => {
            speak(recommendation.exercise.title);
            onOpenRecommendation({
              id: `recommendation-${recommendation.exercise.id}`,
              order: 0,
              exercise: recommendation.exercise,
              completed: false,
            });
          }}
        >
          <span className="stage-number" aria-hidden>
            🌱
          </span>
          <span className="stage-card-body">
            <span className="item-title">نشاط أسهل: {recommendation.exercise.title}</span>
            <span className="item-skill">تدرّب براحة — لن تتقدم المرحلة منه</span>
          </span>
        </button>
      ) : null}

      {items.length === 0 ? <p className="status-text">لا توجد أنشطة في هذه المرحلة بعد</p> : null}

      <ol className="item-list">
        {items.map((item, index) => {
          const exercise = item.exercise;
          if (exercise === null) {
            return (
              <li key={item.id}>
                <div className="item-card pending">
                  <span className="stage-number" aria-hidden>
                    …
                  </span>
                  <span className="stage-card-body">
                    <span className="item-title">نشاط قيد التحضير</span>
                  </span>
                </div>
              </li>
            );
          }
          const done = item.completed || completedItemIds.has(item.id);
          return (
            <li key={item.id}>
              <button
                type="button"
                className={done ? "item-card is-done" : "item-card"}
                aria-label={done ? `${exercise.title} — أكملت هذا النشاط` : undefined}
                onClick={() => {
                  speak(exercise.title);
                  onOpenItem(item);
                }}
              >
                <span className={done ? "stage-number is-done" : "stage-number"} aria-hidden>
                  {done ? "✓" : index + 1}
                </span>
                <span className="item-title">{exercise.title}</span>
                <span className="item-type" aria-hidden="true">
                  {TYPE_EMOJI[exercise.typeCode] ?? "⭐"}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
