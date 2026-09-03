import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckIcon, CopyIcon, DicesIcon } from "lucide-react";
import { toast } from "sonner";

const BASE36_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/** Cryptographically random base36 password (12 chars ≈ 62 bits of entropy). */
export function generatePassword(length = 12): string {
  const limit = Math.floor(0x100000000 / BASE36_ALPHABET.length) * BASE36_ALPHABET.length;
  const words = new Uint32Array(length);
  let result = "";
  while (result.length < length) {
    crypto.getRandomValues(words);
    for (let index = 0; index < words.length && result.length < length; index += 1) {
      const word = words[index];
      // Values above the limit are rejected to keep the distribution unbiased.
      if (word < limit) {
        result += BASE36_ALPHABET[word % BASE36_ALPHABET.length];
      }
    }
  }
  return result;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy(): void {
    if (value === "") {
      return;
    }
    navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => toast.error("Could not copy — select the password and copy it manually"));
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleCopy}
      aria-label="Copy password to clipboard"
      disabled={value === ""}
      className="px-2.5"
    >
      {copied ? <CheckIcon className="text-emerald-600" /> : <CopyIcon />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

interface PasswordFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
}

/**
 * Password input for admin-set temporary passwords: visible by design, with a
 * crypto-random generator and a copy button so it can be shared out-of-band.
 */
export function PasswordField({ id, value, onChange, error }: PasswordFieldProps) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>Password</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 font-mono"
          autoComplete="new-password"
          spellCheck={false}
          required
          minLength={8}
          aria-invalid={error != null}
        />
        <Button type="button" variant="outline" onClick={() => onChange(generatePassword())}>
          <DicesIcon />
          Generate
        </Button>
        <CopyButton value={value} />
      </div>
      {error != null && error !== "" ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
