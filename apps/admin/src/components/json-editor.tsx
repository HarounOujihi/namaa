import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface JsonEditorProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  rows?: number;
  placeholder?: string;
  className?: string;
}

export function JsonEditor({
  id,
  value,
  onChange,
  error = null,
  rows = 8,
  placeholder = "{ }",
  className,
}: JsonEditorProps) {
  function handleBlur(): void {
    const trimmed = value.trim();
    if (trimmed === "") {
      return;
    }
    try {
      const formatted = JSON.stringify(JSON.parse(trimmed), null, 2);
      if (formatted !== value) {
        onChange(formatted);
      }
    } catch {
      // Leave malformed text untouched so the author can fix the syntax.
    }
  }

  return (
    <div className="space-y-1.5">
      <Textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={handleBlur}
        rows={rows}
        placeholder={placeholder}
        spellCheck={false}
        aria-invalid={error !== null}
        className={cn(
          "font-mono text-xs leading-relaxed",
          error !== null && "border-destructive focus-visible:ring-destructive/30",
          className,
        )}
      />
      {error !== null ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
