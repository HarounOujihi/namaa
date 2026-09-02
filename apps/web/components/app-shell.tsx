"use client";

import type { ReactNode } from "react";
import { HeartHandshake, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { initialsOf } from "@/lib/format";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AppShell({
  user,
  onLogout,
  children,
}: {
  user: User;
  onLogout: () => void;
  children: ReactNode;
}) {
  const t = useTranslations("nav");
  const tApp = useTranslations("app");
  const pathname = usePathname();

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-2 font-heading font-semibold">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <HeartHandshake className="size-4" />
            </span>
            <span className="hidden sm:inline">{tApp("title")}</span>
          </Link>
          <div className="ms-auto flex items-center gap-2">
            <LocaleSwitcher />
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <Avatar size="sm">
                <AvatarFallback>{initialsOf(user.fullName)}</AvatarFallback>
              </Avatar>
              <span className="hidden max-w-40 truncate text-sm font-medium md:inline">
                {user.fullName}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              aria-label={t("logoutAria")}
              onClick={onLogout}
            >
              <LogOut />
              <span className="hidden sm:inline">{t("logout")}</span>
            </Button>
          </div>
        </div>
        <nav className="border-t">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-1 px-4 py-1.5">
            <Link
              href="/"
              className={cn(
                "rounded-lg px-2.5 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                pathname === "/" && "bg-muted text-foreground",
              )}
            >
              {t("dashboard")}
            </Link>
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
