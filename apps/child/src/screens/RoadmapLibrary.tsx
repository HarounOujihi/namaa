import type { CSSProperties } from "react";
import { Mascot } from "../components/Mascot";
import { arabicCount, arabicRelativeDay } from "../arabic";
import type { PlayRoadmapProgress, PlayRoadmapSummary } from "../types";
import type { RoadmapBucket } from "../play-views";

/** A roadmap with its merged (server + this session) progress. */
export interface RoadmapEntry {
  roadmap: PlayRoadmapSummary;
  progress: PlayRoadmapProgress;
}

const ROADMAP_FORMS = { one: "رحلة واحدة", two: "رحلتان", few: "رحلات", many: "رحلة" };

const FALLBACK_PALETTES: ReadonlyArray<readonly [string, string]> = [
  ["#ffcc80", "#ff8a65"],
  ["#a5d6a7", "#4db6ac"],
  ["#90caf9", "#7986cb"],
  ["#ffe082", "#ffb74d"],
  ["#f8bbd0", "#ce93d8"],
  ["#b2dfdb", "#81c784"],
];
const FALLBACK_EMOJIS = ["🌟", "🚀", "🌈", "🦉", "📚", "🎈", "🐢", "🌻"];

/** Warm gradient + emoji picked deterministically from an id, so a cover-less card always looks the same. */
function coverFallback(id: string): { style: CSSProperties; emoji: string } {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  const [from, to] = FALLBACK_PALETTES[hash % FALLBACK_PALETTES.length];
  return {
    style: { background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` },
    emoji: FALLBACK_EMOJIS[Math.floor(hash / FALLBACK_PALETTES.length) % FALLBACK_EMOJIS.length],
  };
}

interface CoverProps {
  id: string;
  url: string | null;
  alt: string;
  className?: string;
}

/** 16:9 cover image, or the deterministic gradient + emoji when there is none. */
function Cover({ id, url, alt, className = "" }: CoverProps) {
  if (url !== null) {
    return (
      <span className={`lib-cover ${className}`}>
        <img src={url} alt={alt} loading="lazy" decoding="async" />
      </span>
    );
  }
  const fallback = coverFallback(id);
  return (
    <span className={`lib-cover is-fallback ${className}`} style={fallback.style} role="img" aria-label={alt}>
      <span className="lib-cover-emoji" aria-hidden="true">
        {fallback.emoji}
      </span>
    </span>
  );
}

/** Placeholder cards while the library loads. */
export function LibrarySkeleton() {
  return (
    <div className="lib-page" aria-busy="true" aria-label="جارٍ تحميل الرحلات">
      <ul className="lib-grid">
        {[0, 1, 2].map((key) => (
          <li key={key} className="lib-card is-skeleton" aria-hidden="true">
            <span className="lib-cover lib-shimmer" />
            <span className="lib-skel-line lib-shimmer" />
            <span className="lib-skel-line is-short lib-shimmer" />
          </li>
        ))}
      </ul>
    </div>
  );
}

interface CategoriesPageProps {
  buckets: RoadmapBucket[];
  progressOf: (roadmap: PlayRoadmapSummary) => PlayRoadmapProgress;
  continueEntry: RoadmapEntry | null;
  onOpenBucket: (bucketId: string) => void;
  onOpenRoadmap: (roadmapId: string) => void;
}

/** The library home when roadmaps fall into several groups: "continue" hero + one card per category. */
export function CategoriesPage({ buckets, progressOf, continueEntry, onOpenBucket, onOpenRoadmap }: CategoriesPageProps) {
  return (
    <div className="lib-page">
      {continueEntry !== null ? (
        <ContinueHero entry={continueEntry} onOpen={() => onOpenRoadmap(continueEntry.roadmap.id)} />
      ) : null}
      <h2 className="lib-section-title">اختر عالمك</h2>
      <ul className="lib-grid">
        {buckets.map((bucket, index) => {
          const name = bucket.category?.name ?? "رحلات أخرى";
          const description = bucket.category?.description ?? null;
          const completed = bucket.roadmaps.filter((roadmap) => progressOf(roadmap).completed).length;
          return (
            <li key={bucket.id} className="lib-enter" style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}>
              <button type="button" className="lib-card" onClick={() => onOpenBucket(bucket.id)}>
                <Cover id={bucket.id} url={bucket.category?.coverUrl ?? null} alt={name} />
                <span className="lib-card-body">
                  <span className="lib-card-title">{name}</span>
                  {description !== null && description.length > 0 ? (
                    <span className="lib-card-desc">{description}</span>
                  ) : null}
                  <span className="lib-card-meta">
                    <span className="lib-chip">🧭 {arabicCount(bucket.roadmaps.length, ROADMAP_FORMS)}</span>
                    {completed > 0 ? (
                      <span className="lib-chip is-done">
                        🏆 {completed} من {bucket.roadmaps.length}
                      </span>
                    ) : null}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ContinueHero({ entry, onOpen }: { entry: RoadmapEntry; onOpen: () => void }) {
  const { roadmap, progress } = entry;
  return (
    <button type="button" className="lib-continue lib-enter" onClick={onOpen}>
      <Cover id={roadmap.id} url={roadmap.coverUrl} alt={roadmap.name} className="lib-continue-cover" />
      <span className="lib-continue-body">
        <span className="lib-continue-kicker">تابع رحلتك</span>
        <span className="lib-card-title">{roadmap.name}</span>
        {progress.currentStageName !== null ? (
          <span className="lib-card-desc">📍 {progress.currentStageName}</span>
        ) : null}
        <StageBar progress={progress} />
      </span>
      <span className="lib-continue-go" aria-hidden="true">
        ▶
      </span>
    </button>
  );
}

/** One segment per playable stage, filled for each passed one. */
function StageBar({ progress }: { progress: PlayRoadmapProgress }) {
  const label = `المحطات: ${progress.completedStages} من ${progress.totalStages}`;
  if (progress.totalStages === 0) {
    return null;
  }
  // Many stages: a continuous bar reads better than hair-thin segments.
  if (progress.totalStages > 12) {
    const percent = Math.round((progress.completedStages / progress.totalStages) * 100);
    return (
      <span
        className="roadmap-progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={progress.totalStages}
        aria-valuenow={progress.completedStages}
        aria-label={label}
      >
        <span className="roadmap-progress-fill" style={{ width: `${percent}%` }} />
      </span>
    );
  }
  return (
    <span
      className="lib-segments"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={progress.totalStages}
      aria-valuenow={progress.completedStages}
      aria-label={label}
    >
      {Array.from({ length: progress.totalStages }, (_, index) => (
        <span key={index} className={index < progress.completedStages ? "lib-segment is-filled" : "lib-segment"} />
      ))}
    </span>
  );
}

interface CategoryPageProps {
  bucket: RoadmapBucket;
  /** Home already is this list (a single bucket): generic heading for the "other" bucket. */
  atHome: boolean;
  entries: RoadmapEntry[];
  owlRoadmapId: string | null;
  onOpenRoadmap: (roadmapId: string) => void;
}

/** One group's roadmaps, each card showing status and progress before opening. */
export function CategoryPage({ bucket, atHome, entries, owlRoadmapId, onOpenRoadmap }: CategoryPageProps) {
  const name = bucket.category?.name ?? (atHome ? "اختر رحلتك" : "رحلات أخرى");
  const description = bucket.category?.description ?? (atHome ? "لكل رحلة مغامراتها الخاصة" : null);
  return (
    <div className="lib-page">
      <section className="lib-banner lib-enter">
        <Cover id={bucket.id} url={bucket.category?.coverUrl ?? null} alt={name} className="lib-banner-cover" />
        <span className="lib-banner-shade" aria-hidden="true" />
        <div className="lib-banner-copy">
          <h2 className="lib-banner-title">{name}</h2>
          {description !== null && description.length > 0 ? <p className="lib-banner-desc">{description}</p> : null}
          <span className="lib-chip is-light">🧭 {arabicCount(bucket.roadmaps.length, ROADMAP_FORMS)}</span>
        </div>
      </section>
      <ul className="lib-grid">
        {entries.map((entry, index) => (
          <li key={entry.roadmap.id} className="lib-enter" style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}>
            <RoadmapCard
              entry={entry}
              hasOwl={entry.roadmap.id === owlRoadmapId}
              onOpen={() => onOpenRoadmap(entry.roadmap.id)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function RoadmapCard({ entry, hasOwl, onOpen }: { entry: RoadmapEntry; hasOwl: boolean; onOpen: () => void }) {
  const { roadmap, progress } = entry;
  const status = progress.completed ? "done" : progress.opened ? "going" : "new";
  const chip = status === "done" ? "مكتملة 🏆" : status === "going" ? "تابع" : "جديدة ✨";
  const cta = status === "done" ? "العب مجددًا" : status === "going" ? "تابع" : "ابدأ";
  return (
    <button type="button" className={`lib-card roadmap-lib-card is-${status}`} onClick={onOpen}>
      <span className="lib-cover-wrap">
        <Cover id={roadmap.id} url={roadmap.coverUrl} alt={roadmap.name} />
        <span className={`lib-status is-${status}`}>{chip}</span>
        {hasOwl ? (
          <span className="lib-owl" aria-hidden="true">
            <Mascot />
          </span>
        ) : null}
      </span>
      <span className="lib-card-body">
        <span className="lib-card-title">{roadmap.name}</span>
        {roadmap.description !== null && roadmap.description.length > 0 ? (
          <span className="lib-card-desc">{roadmap.description}</span>
        ) : null}
        {progress.totalStages > 0 ? (
          <span className="lib-progress-block">
            <span className="lib-progress-row">
              <span>
                المحطات: {progress.completedStages} من {progress.totalStages}
              </span>
              {progress.maxStars > 0 ? (
                <span>
                  ⭐ {progress.stars} من {progress.maxStars}
                </span>
              ) : null}
            </span>
            <StageBar progress={progress} />
          </span>
        ) : null}
        {status !== "done" && progress.opened && progress.currentStageName !== null ? (
          <span className="lib-card-meta-line">📍 {progress.currentStageName}</span>
        ) : null}
        {progress.lastActivityAt !== null ? (
          <span className="lib-card-meta-line is-soft">🕒 {arabicRelativeDay(progress.lastActivityAt)}</span>
        ) : null}
        <span className={`lib-cta is-${status}`}>{cta}</span>
      </span>
    </button>
  );
}
