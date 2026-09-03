import { useState, type FormEvent } from "react";
import { SimpleSelect } from "@/components/simple-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, createUser } from "@/api";
import type { Role } from "@/types";
import { getErrorMessage } from "@/lib/use-query";
import { toast } from "sonner";
import { PasswordField, generatePassword } from "./password-field";
import { ROLE_LABEL, ROLE_OPTIONS } from "./roles";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DUPLICATE_EMAIL_MESSAGE = "An account with this email already exists";

interface UserCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function UserCreateDialog({ open, onOpenChange, onCreated }: UserCreateDialogProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("SPECIALIST");
  const [password, setPassword] = useState(() => generatePassword());
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const trimmedEmail = email.trim();
  const trimmedName = fullName.trim();
  const nameInvalid = trimmedName !== "" && trimmedName.length < 2;
  const emailInvalid = trimmedEmail !== "" && !EMAIL_PATTERN.test(trimmedEmail);
  const passwordInvalid = password !== "" && password.length < 8;
  const canSubmit =
    !submitting &&
    trimmedName.length >= 2 &&
    trimmedEmail !== "" &&
    !emailInvalid &&
    password.length >= 8;

  function reset(): void {
    setFullName("");
    setEmail("");
    setRole("SPECIALIST");
    setPassword(generatePassword());
    setEmailError(null);
    setSubmitError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    setEmailError(null);
    try {
      const created = await createUser({
        email: trimmedEmail,
        password,
        fullName: trimmedName,
        role,
      });
      toast.success(`${created.email} can now sign in`, {
        description: `Account created with the ${ROLE_LABEL[role]} role. Share the password securely.`,
      });
      onCreated();
      onOpenChange(false);
      reset();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setEmailError(DUPLICATE_EMAIL_MESSAGE);
      } else if (err instanceof ApiError && err.validationErrors.length > 0) {
        setSubmitError(
          err.validationErrors.map((item) => `${item.path} — ${item.message}`).join("; "),
        );
      } else {
        setSubmitError(getErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset();
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New user</DialogTitle>
          <DialogDescription>
            Create a platform account and hand over the generated password out-of-band.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="user-full-name">Full name</Label>
            <Input
              id="user-full-name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Sara Ahmad"
              autoComplete="off"
              required
              minLength={2}
              aria-invalid={nameInvalid}
            />
            {nameInvalid ? (
              <p className="text-xs text-destructive" role="alert">
                Full name must be at least 2 characters.
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="user-email">Email</Label>
            <Input
              id="user-email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setEmailError(null);
              }}
              placeholder="user@example.com"
              autoComplete="off"
              required
              aria-invalid={emailInvalid || emailError !== null}
            />
            {emailError !== null ? (
              <p className="text-xs text-destructive" role="alert">
                {emailError}
              </p>
            ) : emailInvalid ? (
              <p className="text-xs text-destructive" role="alert">
                Enter a valid email address.
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="user-role">Role</Label>
            <SimpleSelect
              id="user-role"
              value={role}
              onValueChange={(next) => setRole(next as Role)}
              options={ROLE_OPTIONS}
              ariaLabel="Role"
            />
          </div>
          <PasswordField
            id="user-password"
            value={password}
            onChange={setPassword}
            error={passwordInvalid ? "Password must be at least 8 characters." : null}
          />
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
              Create user
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
