import type { PlayRecommendation, PlayStage, PlayStageItem } from "../types";
import { speak } from "../speech";
import { toArabicIndic } from "../arabic";

interface StageScreenProps {
  stage: PlayStage;
  completedItemIds: ReadonlySet<string>;
  onBack: () => void;
  onOpenItem: (item: PlayStageItem) => void;
  recommendation: PlayRecommendation | null;
  onOpenRecommendation: (item: PlayStageItem) => void;
}

/** The items of one roadmap stage as big activity cards. */
export function StageScreen({ stage, completedItemIds, onBack, onOpenItem, recommendation, onOpenRecommendation }: StageScreenProps) {
  const items = stage.items.slice().sort((a, b) => a.order - b.order);

  return (
    <main className="screen">
      <header className="play-header">
        <button type="button" className="text-button" onClick={onBack}>
          رجوع
        </button>
        <h1 className="screen-title">{stage.name}</h1>
      </header>

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
          return (
            <li key={item.id}>
              <button
                type="button"
                className="item-card"
                onClick={() => {
                  speak(exercise.title);
                  onOpenItem(item);
                }}
              >
                <span className="stage-number" aria-hidden>
                  {toArabicIndic(index + 1)}
                </span>
                <span className="stage-card-body">
                  <span className="item-title">{exercise.title}</span>
                  <span className="item-skill">المهارة: {exercise.skill.name}</span>
                </span>
                {completedItemIds.has(item.id) ? (
                  <span className="item-check" aria-label="أكملت هذا النشاط">
                    ✓
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
