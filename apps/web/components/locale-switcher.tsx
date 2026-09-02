"use client";

import { CheckIcon, Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { updateLocale } from "@/lib/api";
import type { AppLocale } from "@/lib/types";

const LOCALES: readonly AppLocale[] = ["ar", "en", "fr"];

export function LocaleSwitcher() {
  const t = useTranslations("locale");
  const current = useLocale();
  const active: AppLocale = (LOCALES as readonly string[]).includes(current)
    ? (current as AppLocale)
    : "ar";

  async function switchLocale(locale: AppLocale): Promise<void> {
    if (locale === active) {
      return;
    }
    document.cookie = `NEXT_LOCALE=${locale};path=/;max-age=31536000;samesite=lax`;
    // Persist the preference server-side; switching proceeds even if this fails.
    await updateLocale(locale).catch(() => undefined);
    window.location.reload();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="sm" aria-label={t("label")} />}
      >
        <Languages />
        <span className="hidden sm:inline">{t(active)}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("label")}</DropdownMenuLabel>
          {LOCALES.map((locale) => (
            <DropdownMenuItem key={locale} onClick={() => void switchLocale(locale)}>
              <span className="flex w-full items-center justify-between gap-4">
                <span>{t(locale)}</span>
                {locale === active ? <CheckIcon className="size-4" /> : null}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
