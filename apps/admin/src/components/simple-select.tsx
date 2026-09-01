import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SimpleSelectProps {
  value: string | null;
  onValueChange: (value: string) => void;
  options: readonly SelectOption[];
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "default";
  ariaLabel?: string;
}

export function SimpleSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select…",
  id,
  disabled,
  className,
  size = "default",
  ariaLabel,
}: SimpleSelectProps) {
  const items = useMemo(() => {
    const map: Record<string, string> = {};
    for (const option of options) {
      map[option.value] = option.label;
    }
    return map;
  }, [options]);

  return (
    <Select
      value={value === null || value === "" ? null : value}
      items={items}
      onValueChange={(next) => {
        if (typeof next === "string") {
          onValueChange(next);
        }
      }}
    >
      <SelectTrigger
        id={id}
        disabled={disabled}
        className={className}
        size={size}
        aria-label={ariaLabel}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
