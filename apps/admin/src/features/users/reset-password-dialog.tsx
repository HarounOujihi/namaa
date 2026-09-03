import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ShieldAlertIcon } from "lucide-react";
import { resetUserPassword } from "@/api";
import type { AdminUser } from "@/types";
import { getErrorMessage } from "@/lib/use-query";
import { toast } from "sonner";
import { PasswordField, generatePassword } from "./password-field";

interface ResetPasswordDialogProps {
  user: AdminUser | null;
  onOpenChange: (open: boolean) => void;
}

export function ResetPasswordDialog({ user, onOpenChange }: ResetPasswordDialogProps) {
  const [password, setPassword] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // A fresh generated password every time the dialog opens for a user.
  useEffect(() => {
    if (user !== null) {
      setPassword(generatePassword());
      setSubmitError(null);
      setSubmitting(false);
    }
  }, [user]);

  const passwordInvalid = password !== "" && password.length < 8;
  const canSubmit = !submitting && password.length >= 8;

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (user === null || !canSubmit) {
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await resetUserPassword(user.id, password);
      toast.success(`Password updated for ${user.email}`);
      onOpenChange(false);
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={user !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            Set a new password for {user?.email ?? "this user"}. It takes effect immediately —
            the current password stops working.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <PasswordField
            id="reset-password"
            value={password}
            onChange={setPassword}
            error={passwordInvalid ? "Password must be at least 8 characters." : null}
          />
          <p className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
            <ShieldAlertIcon className="mt-0.5 size-3.5 shrink-0" />
            Share securely — shown once.
          </p>
          {submitError !== null ? (
            <p className="text-sm text-destructive" role="alert">
              {submitError}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              Reset password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
