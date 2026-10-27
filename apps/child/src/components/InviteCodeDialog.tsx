import { useState } from "react";
import { Dialog } from "./Dialog";

interface InviteCodeDialogProps {
  code: string;
  onClose: () => void;
}

export function InviteCodeDialog({ code, onClose }: InviteCodeDialogProps) {
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);

  async function copyCode(): Promise<void> {
    setCopied(false);
    setCopying(true);
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // Clipboard access can be blocked; the code stays selectable as text.
    } finally {
      setCopying(false);
    }
  }

  return (
    <Dialog title="رمز الانضمام" onClose={onClose}>
      <p className="invite-text">شارك هذا الرمز مع ولي الأمر:</p>
      <output className="invite-code" dir="ltr">
        {code}
      </output>
      <div className="dialog-actions">
        <button type="button" className="big-button confirm" disabled={copying} onClick={() => void copyCode()}>
          {copying ? "جارٍ النسخ…" : copied ? "تم النسخ" : "نسخ الرمز"}
        </button>
        <button type="button" className="big-button neutral" onClick={onClose}>
          تم
        </button>
      </div>
    </Dialog>
  );
}
