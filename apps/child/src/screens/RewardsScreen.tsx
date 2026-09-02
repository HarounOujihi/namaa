import { useCallback, useEffect, useState } from "react";
import { ApiError, equipPlayReward, getPlayRewards, purchasePlayReward } from "../api";
import type { PlayRewardItem, PlayRewards } from "../types";
import { playAppSound } from "../app-sounds";
import { toArabicIndic } from "../arabic";

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
 * 🎁 The child's treasure room: points balance, lifetime stars, the nine skill
 * badges (earned or still locked), and the customization shop where points buy
 * a colored ring the owl wears on the journey map. Positive-only everywhere.
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

  return (
    <main className="screen rewards-screen">
      <header className="play-header">
        <button type="button" className="text-button" onClick={onBack}>
          رجوع
        </button>
        <h1 className="screen-title">جوائزي 🎁</h1>
        {rewards !== null ? (
          <span className="rewards-chip" aria-label={`مجموع النجوم ${toArabicIndic(rewards.stars)}`}>
            ⭐ {toArabicIndic(rewards.stars)}
          </span>
        ) : (
          <span className="rewards-chip is-empty" aria-hidden />
        )}
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
          <section className="card rewards-summary" aria-label="رصيد النقاط والنجوم">
            <p className="rewards-balance">
              <span className="rewards-balance-number">{toArabicIndic(rewards.balance)}</span>
              <span className="rewards-balance-unit">نقطة</span>
            </p>
            <p className="rewards-stars">⭐ {toArabicIndic(rewards.stars)}</p>
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
            <h2 className="rewards-section-title">🏅 الأوسمة</h2>
            {rewards.badges.length === 0 ? (
              <p className="status-text">لا توجد أوسمة بعد</p>
            ) : (
              <ul className="badges-grid">
                {rewards.badges.map((badge) => {
                  const dateText = badge.earnedAt !== null ? formatEarnedDate(badge.earnedAt) : null;
                  return (
                    <li
                      key={badge.code}
                      className={badge.earnedAt !== null ? "badge-card is-earned" : "badge-card"}
                    >
                      <span className="badge-medal" aria-hidden>
                        {badge.earnedAt !== null ? "🏅" : "🔒"}
                      </span>
                      <span className="badge-name">{badge.name}</span>
                      {badge.earnedAt !== null && dateText !== null ? (
                        <span className="badge-date">{dateText}</span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rewards-section" aria-label="متجر الألوان">
            <h2 className="rewards-section-title">🛍️ متجر الألوان</h2>
            {rewards.items.length === 0 ? (
              <p className="status-text">لا توجد عناصر بعد</p>
            ) : (
              <ul className="shop-grid">
                {rewards.items.map((item) => {
                  const busy = busyItemId === item.id;
                  return (
                    <li key={item.id} className={item.equipped ? "shop-card is-equipped" : "shop-card"}>
                      <span className="shop-swatch" style={{ backgroundColor: item.color }} aria-hidden />
                      <span className="shop-name">{item.name}</span>
                      <span className="shop-price">{toArabicIndic(item.price)} نقطة</span>
                      <div className="shop-actions">
                        {item.owned ? (
                          <>
                            <button type="button" className="shop-button" disabled>
                              مملوك
                            </button>
                            <button
                              type="button"
                              className="shop-button is-equip"
                              disabled={busy || item.equipped}
                              onClick={() => runItemAction(item, "equip")}
                            >
                              {item.equipped ? "مرتدى" : "ارتداء"}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="shop-button is-buy"
                            disabled={busy}
                            onClick={() => runItemAction(item, "purchase")}
                          >
                            {busy ? "…" : "شراء"}
                          </button>
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
