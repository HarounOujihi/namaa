import { useCallback, useEffect, useState } from "react";
import { ApiError, listChildren } from "../api";
import type { AuthResponse, Child } from "../types";
import { Avatar } from "../components/Avatar";
import { AddChildDialog } from "../components/AddChildDialog";
import { EditChildDialog } from "../components/EditChildDialog";
import { InviteCodeDialog } from "../components/InviteCodeDialog";
import { RedeemInviteDialog } from "../components/RedeemInviteDialog";
import { speak } from "../speech";

interface ChildPickerProps {
  auth: AuthResponse;
  onChildSelected: (child: Child) => void;
  onShowResults: (child: Child) => void;
  onAuthExpired: () => void;
  onLogout: () => void;
}

type PickerDialog =
  | { kind: "none" }
  | { kind: "add" }
  | { kind: "invite"; code: string }
  | { kind: "redeem" }
  | { kind: "edit"; child: Child };

export function ChildPicker({ auth, onChildSelected, onShowResults, onAuthExpired, onLogout }: ChildPickerProps) {
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<PickerDialog>({ kind: "none" });

  const isParent = auth.user.role === "PARENT";

  const refreshChildren = useCallback(async (): Promise<void> => {
    setLoading(true);
    setLoadError(null);
    try {
      setChildren(await listChildren(auth.accessToken));
      setLoading(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onAuthExpired();
        return;
      }
      setLoading(false);
      setLoadError(err instanceof ApiError ? err.message : "تعذر تحميل الأطفال، حاول مرة أخرى");
    }
  }, [auth.accessToken, onAuthExpired]);

  useEffect(() => {
    void refreshChildren();
  }, [refreshChildren]);

  const handleCardTap = (child: Child): void => {
    speak(`أهلًا ${child.fullName}`);
    onChildSelected(child);
  };

  return (
    <main className="screen picker-screen">
      <header className="picker-header">
        <h1 className="screen-title">من يلعب اليوم؟</h1>
        <button type="button" className="text-button" onClick={onLogout}>
          خروج
        </button>
      </header>

      {loading ? <p className="status-text">جارٍ التحميل…</p> : null}
      {!loading && loadError !== null ? (
        <div className="card retry-card">
          <p className="form-error" role="alert">
            {loadError}
          </p>
          <button type="button" className="big-button" onClick={() => void refreshChildren()}>
            إعادة المحاولة
          </button>
        </div>
      ) : null}
      {!loading && loadError === null && children.length === 0 ? (
        <p className="status-text">لا يوجد أطفال بعد، أضف طفلًا للبدء.</p>
      ) : null}
      {!loading && loadError === null && children.length > 0 ? (
        <ul className="child-grid">
          {children.map((child) => (
            <li key={child.id} className="child-card">
              <button type="button" className="child-tap" onClick={() => handleCardTap(child)}>
                <Avatar child={child} />
                <span className="child-name">{child.fullName}</span>
              </button>
              <div className="child-actions">
                <button
                  type="button"
                  className="icon-button compact"
                  aria-label={`نتائج التشخيص لـ${child.fullName}`}
                  onClick={() => onShowResults(child)}
                >
                  📊
                </button>
                {isParent ? (
                  <button
                    type="button"
                    className="icon-button compact"
                    aria-label={`إدارة ملف ${child.fullName}`}
                    onClick={() => setDialog({ kind: "edit", child })}
                  >
                    ⚙️
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="picker-actions">
        <button type="button" className="big-button" onClick={() => setDialog({ kind: "add" })}>
          ➕ إضافة طفل جديد
        </button>
        {isParent ? (
          <button type="button" className="text-button" onClick={() => setDialog({ kind: "redeem" })}>
            لديك رمز من مختص؟
          </button>
        ) : null}
      </div>

      {dialog.kind === "add" ? (
        <AddChildDialog
          token={auth.accessToken}
          onAuthExpired={onAuthExpired}
          onCancel={() => setDialog({ kind: "none" })}
          onCreated={(result) => {
            setDialog(
              result.inviteCode === null ? { kind: "none" } : { kind: "invite", code: result.inviteCode },
            );
            void refreshChildren();
          }}
        />
      ) : null}
      {dialog.kind === "invite" ? (
        <InviteCodeDialog code={dialog.code} onClose={() => setDialog({ kind: "none" })} />
      ) : null}
      {dialog.kind === "redeem" ? (
        <RedeemInviteDialog
          token={auth.accessToken}
          onAuthExpired={onAuthExpired}
          onCancel={() => setDialog({ kind: "none" })}
          onRedeemed={() => {
            setDialog({ kind: "none" });
            void refreshChildren();
          }}
        />
      ) : null}
      {dialog.kind === "edit" ? (
        <EditChildDialog
          token={auth.accessToken}
          child={dialog.child}
          onAuthExpired={onAuthExpired}
          onCancel={() => setDialog({ kind: "none" })}
          onSaved={() => {
            setDialog({ kind: "none" });
            void refreshChildren();
          }}
        />
      ) : null}

    </main>
  );
}
