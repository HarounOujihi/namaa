import { useCallback, useEffect, useState } from "react";
import { ApiError, equipPlayReward, getPlayRewards, purchasePlayReward } from "../api";
import type { PlayRewardItem, PlayRewards } from "../types";
import { Mascot } from "../components/Mascot";
import { playAppSound } from "../app-sounds";
import { toArabicIndic } from "../arabic";
import "./rewards-screen.css";

interface RewardsScreenProps {
  token: string;
  childId: string;
  /** Fresh rewards are pushed up so the journey map's owl ring stays in sync. */
  onRewardsLoaded: (rewards: PlayRewards) => void;
  onAuthExpired: () => void;
  onBack: () => void;
}

/** Toast-ish inline note: celebrate on success, gentle info otherwise. */
interface InlineStatus {
  kind: "celebrate" | "note";
  message: string;
}

/** ISO date → "٢ سبتمبر ٢٠٢٦" for an earned badge; null when unparsable. */
function formatEarnedDate(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleDateString("ar", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * 🎁 The child's treasure room: a warm hero card with the owl (wearing
 * whatever the child equipped) and the big points balance beside the
 * lifetime stars, a wall of badge medallions — earned gold or locked
 * dashed — and the customization shop whose cards preview each item on a
 * mini owl before buying. Positive-only everywhere.
 */
export function RewardsScreen({ token, childId, onRewardsLoaded, onAuthExpired, onBack }: RewardsScreenProps) {
  const [rewards, setRewards] = useState<PlayRewards | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<InlineStatus | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  const loadRewards = useCallback(
    async (silent = false): Promise<void> => {
      if (!silent) {
        setLoading(true);
        setLoadError(null);
      }
      try {
        const data = await getPlayRewards(token, childId);
        setRewards(data);
        onRewardsLoaded(data);
        if (!silent) {
          setLoading(false);
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          onAuthExpired();
          return;
        }
        // A silent refresh keeps whatever is already on screen.
        if (silent) {
          return;
        }
        setLoading(false);
        setLoadError(error instanceof ApiError ? error.message : "تعذر تحميل الجوائز، حاول مرة أخرى");
      }
    },
    [token, childId, onAuthExpired, onRewardsLoaded],
  );

  useEffect(() => {
    void loadRewards();
  }, [loadRewards]);

  const runItemAction = (item: PlayRewardItem, action: "purchase" | "equip"): void => {
    if (busyItemId !== null) {
      return;
    }
    setBusyItemId(item.id);
    setStatus(null);
    const request =
      action === "purchase"
        ? purchasePlayReward(token, childId, item.id)
        : equipPlayReward(token, childId, item.id);
    void request
      .then(async () => {
        if (action === "purchase") {
          playAppSound("CELEBRATION_CORRECT");
          setStatus({ kind: "celebrate", message: "رائع! عنصر جديد لك 🎁" });
        } else {
          setStatus({ kind: "note", message: "البومة ترتديه الآن ✨" });
        }
        await loadRewards(true);
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 401) {
          onAuthExpired();
          return;
        }
        // Informational only (e.g. "نقاط غير كافية") — never scolding, never red.
        setStatus({
          kind: "note",
          message: error instanceof ApiError ? error.message : "تعذر إتمام العملية، حاول مرة أخرى",
        });
      })
      .finally(() => {
        setBusyItemId(null);
      });
  };

  // The hero owl mirrors the journey map: scarf worn, halo glowing.
  const equippedItem = rewards?.items.find((item) => item.equipped) ?? null;
  const heroScarfColor =
    equippedItem !== null && equippedItem.code.startsWith("OWL_SCARF") ? equippedItem.color : null;
  const heroGlow =
    equippedItem !== null && equippedItem.code.startsWith("OWL_HALO")
      ? { boxShadow: `0 0 0 5px ${equippedItem.color}55, 0 0 26px ${equippedItem.color}88` }
      : undefined;

  return (
    <main className="screen rewards-screen">
      <header className="rewards-top">
        <div className="rewards-top-row">
          <button type="button" className="text-button" onClick={onBack}>
            رجوع
          </button>
          <h1 className="rewards-title">جوائزي 🎁</h1>
          <span className="rewards-top-tail" aria-hidden="true" />
        </div>
      </header>

      {loading ? <p className="status-text">جارٍ تحميل الجوائز…</p> : null}
      {!loading && loadError !== null ? (
        <div className="card retry-card">
          <p className="form-error" role="alert">
            {loadError}
          </p>
          <button type="button" className="big-button" onClick={() => void loadRewards()}>
            إعادة المحاولة
          </button>
        </div>
      ) : null}

      {!loading && rewards !== null ? (
        <>
          <section className="rewards-hero" aria-label="رصيد النقاط والنجوم">
            <span className="rewards-spark is-top" aria-hidden="true">
              ✨
            </span>
            <span className="rewards-spark is-bottom" aria-hidden="true">
              ✨
            </span>
            <div className="rewards-hero-owl" style={heroGlow}>
              <Mascot scarfColor={heroScarfColor} />
            </div>
            <div className="rewards-hero-copy">
              <p className="rewards-hero-balance">
                <span className="rewards-hero-number">{toArabicIndic(rewards.balance)}</span>
                <span className="rewards-hero-unit">نقطة</span>
              </p>
              <p className="rewards-hero-stars">
                ⭐ {toArabicIndic(rewards.stars)}
                <span className="rewards-hero-stars-unit">نجمة</span>
              </p>
            </div>
          </section>

          {status !== null ? (
            <p
              className={status.kind === "celebrate" ? "rewards-status is-celebrate" : "rewards-status"}
              role="status"
            >
              {status.message}
            </p>
          ) : null}

          <section className="rewards-section" aria-label="الأوسمة">
            <h2 className="rewards-section-title">🏅 وسامي</h2>
            {rewards.badges.length === 0 ? (
              <p className="status-text">لا توجد أوسمة بعد</p>
            ) : (
              <ul className="rewards-badges">
                {rewards.badges.map((badge, index) => {
                  const dateText = badge.earnedAt !== null ? formatEarnedDate(badge.earnedAt) : null;
                  return (
                    <li
                      key={badge.code}
                      className={badge.earnedAt !== null ? "badge-medal is-earned" : "badge-medal"}
                      style={{ animationDelay: `${Math.min(index, 9) * 55}ms` }}
                    >
                      <span className="badge-medal-circle" aria-hidden="true">
                        {badge.earnedAt !== null ? "🏅" : "🔒"}
                      </span>
                      <span className="badge-medal-name">{badge.name}</span>
                      {badge.earnedAt !== null && dateText !== null ? (
                        <span className="badge-medal-date">{dateText}</span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rewards-section" aria-label="متجر الوشاح">
            <h2 className="rewards-section-title">🛍️ متجر الوشاح</h2>
            {rewards.items.length === 0 ? (
              <p className="status-text">لا توجد عناصر بعد</p>
            ) : (
              <ul className="rewards-shop">
                {rewards.items.map((item, index) => {
                  const busy = busyItemId === item.id;
                  const scarf = item.code.startsWith("OWL_SCARF");
                  const missingPoints = item.price - rewards.balance;
                  const cardClass = `shop-card${item.owned ? " is-owned" : ""}${item.equipped ? " is-equipped" : ""}`;
                  return (
                    <li key={item.id} className={cardClass} style={{ animationDelay: `${Math.min(index, 7) * 60}ms` }}>
                      <div className="shop-preview" aria-hidden="true">
                        {scarf ? null : (
                          <span
                            className="shop-preview-glow"
                            style={{
                              background: `radial-gradient(circle, ${item.color}66 0%, ${item.color}26 52%, rgba(255, 255, 255, 0) 74%)`,
                            }}
                          />
                        )}
                        <Mascot scarfColor={scarf ? item.color : null} />
                      </div>
                      <span className="shop-price">{toArabicIndic(item.price)} نقطة</span>
                      <span className="shop-name">{item.name}</span>
                      <div className="shop-actions">
                        {item.equipped ? (
                          <span className="shop-state">مرتدى ✓</span>
                        ) : item.owned ? (
                          <button
                            type="button"
                            className="shop-button is-equip"
                            disabled={busy}
                            onClick={() => runItemAction(item, "equip")}
                          >
                            {busy ? "…" : "ارتداء"}
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="shop-button is-buy"
                              disabled={busy || rewards.balance < item.price}
                              onClick={() => runItemAction(item, "purchase")}
                            >
                              {busy ? "…" : "شراء"}
                            </button>
                            {rewards.balance < item.price ? (
                              <span className="shop-note">
                                تحتاج {toArabicIndic(missingPoints)} نقطة إضافية
                              </span>
                            ) : null}
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
