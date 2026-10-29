import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { PlayStage } from "../types";
import { Mascot } from "./Mascot";
import "./journey-map.css";

/** Vertical rhythm of the map: every stage occupies one fixed-height row. */
const TOP_PAD = 64;
const BOTTOM_PAD = 56;
const ROW_HEIGHT = 190;
const NODE_TOP = 10;
const NODE_SIZE = 84;
const NODE_CENTER_Y = NODE_TOP + NODE_SIZE / 2;
/** Zigzag lanes as a share of the map width, counted from the inline-start edge. */
const LANES = [22, 50, 78, 50];
const DECO_EMOJI = ["🌴", "🌿"];
const DECO_NUDGE = [
  { dx: 4, dy: 16 },
  { dx: -7, dy: 106 },
  { dx: 9, dy: 12 },
  { dx: -4, dy: 110 },
];
const LOCKED_HINT = "أكمل المرحلة السابقة أولًا 🌱";

type NodeStatus = "completed" | "current" | "open" | "locked" | "soon";

interface JourneyRow {
  stage: PlayStage;
  status: NodeStatus;
  lane: number;
  top: number;
}

interface JourneyMapProps {
  stages: PlayStage[];
  completedItemIds: ReadonlySet<string>;
  onOpenStage: (stage: PlayStage) => void;
  /** The child's equipped customization item — scarves are worn on the owl, halos glow around it. */
  equippedItem?: { code: string; color: string } | null;
}

const STATUS_ARIA: Record<NodeStatus, string> = {
  completed: "مكتملة",
  current: "مفتوحة، أنت هنا",
  open: "مفتوحة",
  locked: "مقفلة",
  soon: "قيد التحضير",
};

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** A gentle sideways wash line repeated across the map width. */
function wavePath(width: number, y: number): string {
  const step = 56;
  let d = `M ${-step} ${y} q ${step / 2} -11 ${step} 0`;
  for (let x = 0; x <= width + step; x += step) {
    d += ` t ${step} 0`;
  }
  return d;
}

/** A smooth S-road through the node centers (cubic curves, vertical handles). */
function roadPath(centers: Array<{ x: number; y: number }>): string {
  return centers.reduce((d, point, i) => {
    if (i === 0) {
      return `M ${point.x} ${point.y}`;
    }
    const prev = centers[i - 1];
    const midY = (prev.y + point.y) / 2;
    return `${d} C ${prev.x} ${midY}, ${point.x} ${midY}, ${point.x} ${point.y}`;
  }, "");
}

/**
 * The roadmap drawn as an island journey: a winding sandy road, one round stage
 * node per stop, and the owl mascot perched on the current stop.
 */
export function JourneyMap({ stages, completedItemIds, onOpenStage, equippedItem = null }: JourneyMapProps) {
  const mapRef = useRef<HTMLElement | null>(null);
  const [width, setWidth] = useState(0);
  const [rtl, setRtl] = useState(true);
  const [nudgedId, setNudgedId] = useState<string | null>(null);
  const hintTimer = useRef<number | undefined>(undefined);

  useLayoutEffect(() => {
    const el = mapRef.current;
    if (el === null) {
      return;
    }
    const measure = (): void => {
      setWidth(el.clientWidth);
      setRtl(getComputedStyle(el).direction === "rtl");
    };
    measure();
    // ResizeObserver needs Chrome 64 / iOS 13.4; older devices re-measure on window resize.
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => window.clearTimeout(hintTimer.current), []);

  // Merge server truth with this session's per-item checkmarks: a stage counts
  // as done when the server says so OR the child just finished every playable
  // item in it. Unlocking also chains: finishing stage N opens N+1 instantly.
  const meta = stages.map((stage) => {
    const playableIds = stage.items
      .filter((item) => item.exercise !== null)
      .map((item) => item.id);
    const sessionComplete =
      playableIds.length > 0 && playableIds.every((id) => completedItemIds.has(id));
    return { stage, soon: stage.totalItems === 0, complete: stage.completed || sessionComplete };
  });

  let previousDone = true;
  let currentFound = false;
  const rows: JourneyRow[] = meta.map(({ stage, soon, complete }, index) => {
    const unlocked = !soon && (stage.unlocked || previousDone);
    let status: NodeStatus;
    if (soon) {
      status = "soon";
    } else if (complete) {
      status = "completed";
    } else if (unlocked && !currentFound) {
      status = "current";
      currentFound = true;
    } else {
      status = unlocked ? "open" : "locked";
    }
    if (!soon) {
      previousDone = previousDone && complete;
    }
    return {
      stage,
      status,
      lane: LANES[index % LANES.length],
      top: TOP_PAD + index * ROW_HEIGHT,
    };
  });
  // Every stop is done: the owl rests on the last one, at the finish line.
  if (!currentFound) {
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      if (rows[i].status !== "soon") {
        rows[i] = { ...rows[i], status: "current" };
        break;
      }
    }
  }

  const nudge = (stageId: string, event: ReactMouseEvent<HTMLButtonElement>): void => {
    setNudgedId(stageId);
    window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setNudgedId(null), 2800);
    if (prefersReducedMotion()) {
      return;
    }
    event.currentTarget.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-7px)" },
        { transform: "translateX(7px)" },
        { transform: "translateX(-5px)" },
        { transform: "translateX(5px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 450, easing: "ease-in-out" },
    );
  };

  const mapHeight = TOP_PAD + rows.length * ROW_HEIGHT + BOTTOM_PAD;
  const laneX = (lane: number): number =>
    rtl ? width - (width * lane) / 100 : (width * lane) / 100;
  const centers = rows.map((row) => ({ x: laneX(row.lane), y: row.top + NODE_CENTER_Y }));
  const road = centers.length > 1 ? roadPath(centers) : "";

  const pebbles: Array<{ x: number; y: number; r: number }> = [];
  for (let i = 0; i + 1 < centers.length; i += 1) {
    const a = centers[i];
    const b = centers[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const px = -dy / len;
    const py = dx / len;
    const side = i % 2 === 0 ? 1 : -1;
    pebbles.push(
      { x: a.x + dx * 0.32 + px * side * 15, y: a.y + dy * 0.32 + py * side * 15, r: 4.5 },
      { x: a.x + dx * 0.66 - px * side * 13, y: a.y + dy * 0.66 - py * side * 13, r: 3.2 },
    );
  }

  const decorations = rows.map((row, i) => {
    const nudgeAt = DECO_NUDGE[i % DECO_NUDGE.length];
    return {
      emoji: i === rows.length - 1 ? "🐚" : DECO_EMOJI[i % DECO_EMOJI.length],
      x: laneX(100 - row.lane + nudgeAt.dx),
      y: row.top + nudgeAt.dy,
    };
  });

  const hintRow = nudgedId === null ? null : (rows.find((row) => row.stage.id === nudgedId) ?? null);

  return (
    <section className="journey" ref={mapRef} style={{ height: mapHeight }} aria-label="خريطة رحلة التعلم">
      {width > 0 ? (
        <svg
          className="journey-art"
          viewBox={`0 0 ${width} ${mapHeight}`}
          width={width}
          height={mapHeight}
          aria-hidden="true"
          focusable="false"
        >
          {[16, 30, 44].map((y, i) => (
            <path
              key={`wave-top-${i}`}
              className="journey-wave"
              style={{ opacity: 0.3 + i * 0.25 }}
              d={wavePath(width, y)}
            />
          ))}
          {[mapHeight - 44, mapHeight - 30, mapHeight - 16].map((y, i) => (
            <path
              key={`wave-bottom-${i}`}
              className="journey-wave"
              style={{ opacity: 0.3 + i * 0.25 }}
              d={wavePath(width, y)}
            />
          ))}
          {road !== "" ? (
            <>
              <path className="journey-road-edge" d={road} />
              <path className="journey-road" d={road} />
              <path className="journey-road-dashes" d={road} />
            </>
          ) : null}
          {pebbles.map((pebble, i) => (
            <circle
              key={`pebble-${i}`}
              className="journey-pebble"
              style={{ opacity: i % 2 === 0 ? 0.7 : 0.5 }}
              cx={pebble.x}
              cy={pebble.y}
              r={pebble.r}
            />
          ))}
          {decorations.map((deco, i) => (
            <text
              key={`deco-${i}`}
              className="journey-deco"
              x={deco.x}
              y={deco.y}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {deco.emoji}
            </text>
          ))}
        </svg>
      ) : null}

      <ol className="journey-rows">
        {rows.map((row, index) => {
          const number = String(index + 1);
          return (
            <li
              key={row.stage.id}
              className={row.status === "soon" ? "journey-row is-soon" : "journey-row"}
              style={{ insetInlineStart: `calc(${row.lane}% - min(23vw, 85px))`, top: row.top }}
            >
              {row.status === "soon" ? (
                <div className="journey-node is-soon" aria-hidden="true">
                  <span className="journey-glyph">🌱</span>
                </div>
              ) : (
                <button
                  type="button"
                  className={`journey-node is-${row.status}`}
                  aria-label={`المرحلة ${number}: ${row.stage.name} — ${STATUS_ARIA[row.status]}`}
                  aria-disabled={row.status === "locked" ? true : undefined}
                  onClick={(event) => {
                    if (row.status === "locked") {
                      nudge(row.stage.id, event);
                      return;
                    }
                    onOpenStage(row.stage);
                  }}
                >
                  <span className="journey-glyph" aria-hidden="true">
                    {row.status === "completed"
                      ? "✓"
                      : row.status === "locked"
                        ? "🔒"
                        : number}
                  </span>
                </button>
              )}
              {row.status === "current" ? (
                <span
                  className="journey-owl"
                  aria-hidden="true"
                  style={
                    equippedItem !== null && equippedItem.code.startsWith("OWL_HALO")
                      ? { boxShadow: `0 0 0 5px ${equippedItem.color}55, 0 0 22px ${equippedItem.color}88` }
                      : undefined
                  }
                >
                  <Mascot
                    scarfColor={
                      equippedItem !== null && equippedItem.code.startsWith("OWL_SCARF") ? equippedItem.color : null
                    }
                  />
                </span>
              ) : null}
              <span className="journey-label" aria-hidden={row.status !== "soon"}>
                {row.status === "soon" ? "قيد التحضير" : row.stage.name}
              </span>
            </li>
          );
        })}
      </ol>

      {hintRow !== null ? (
        <p className="journey-hint" role="status" style={{ top: hintRow.top + 138 }}>
          {LOCKED_HINT}
        </p>
      ) : null}
    </section>
  );
}
