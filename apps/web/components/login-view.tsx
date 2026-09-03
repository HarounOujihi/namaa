"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { HeartHandshake, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, isNetworkError, login, register } from "@/lib/api";
import { persistAuth } from "@/lib/auth-storage";
import type { AuthResponse } from "@/lib/types";

export function LoginView({ onSuccess }: { onSuccess: (auth: AuthResponse) => void }) {
  const t = useTranslations("login");
  const tErrors = useTranslations("errors");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const auth =
        mode === "signup"
          ? await register(fullName.trim(), email.trim(), password)
          : await login(email.trim(), password);
      persistAuth(auth);
      onSuccess(auth);
    } catch (err) {
      if (isNetworkError(err)) {
        setError(tErrors("network"));
        toast.error(tErrors("network"));
      } else if (err instanceof ApiError && err.status === 401) {
        setError(t("invalid"));
        toast.error(t("invalid"));
      } else if (err instanceof ApiError && err.message.length > 0) {
        setError(err.message);
        toast.error(err.message);
      } else if (err instanceof ApiError && err.status === 409) {
        setError(t("signup.emailTaken"));
        toast.error(t("signup.emailTaken"));
      } else {
        setError(tErrors("generic"));
        toast.error(tErrors("generic"));
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-svh place-items-center bg-muted/40 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <span className="mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <HeartHandshake className="size-6" />
          </span>
          <CardTitle className="text-xl">{mode === "signup" ? t("signup.title") : t("title")}</CardTitle>
          <CardDescription>{mode === "signup" ? t("signup.subtitle") : t("subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            {mode === "signup" ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="login-name">{t("signup.fullName")}</Label>
                <Input
                  id="login-name"
                  placeholder={t("signup.fullName")}
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  autoComplete="name"
                  required
                  minLength={2}
                />
              </div>
            ) : null}
            <div className="flex flex-col gap-2">
              <Label htmlFor="login-email">{t("email")}</Label>
              <Input
                id="login-email"
                type="email"
                dir="ltr"
                placeholder={t("emailPlaceholder")}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="login-password">{t("password")}</Label>
              <Input
                id="login-password"
                type="password"
                dir="ltr"
                placeholder={t("passwordPlaceholder")}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                required
                minLength={mode === "signup" ? 8 : undefined}
              />
              {mode === "signup" ? (
                <p className="text-xs text-muted-foreground">{t("signup.passwordHint")}</p>
              ) : null}
            </div>
            {error !== null ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              {pending ? t("pending") : mode === "signup" ? t("signup.submit") : t("submit")}
            </Button>
            <Button
              type="button"
              variant="link"
              className="w-full text-sm"
              onClick={() => {
                setMode(mode === "signup" ? "login" : "signup");
                setError(null);
              }}
            >
              {mode === "signup" ? t("signup.backToLogin") : t("signup.link")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
