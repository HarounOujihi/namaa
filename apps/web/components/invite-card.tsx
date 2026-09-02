"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { LoaderCircleIcon, TicketIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, redeemInvite } from "@/lib/api";
import { useApiErrorMessage } from "@/lib/format";

export function InviteCard({ onRedeemed }: { onRedeemed: () => void }) {
  const t = useTranslations("invite");
  const apiErrorMessage = useApiErrorMessage();
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);

  async function handleRedeem(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmed = code.trim();
    if (pending || trimmed.length === 0) {
      return;
    }
    setPending(true);
    try {
      const result = await redeemInvite(trimmed.toUpperCase());
      toast.success(
        result.alreadyLinked
          ? t("alreadyLinked", { name: result.child.fullName })
          : t("success", { name: result.child.fullName }),
      );
      setCode("");
      onRedeemed();
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        toast.error(t("invalid"));
      } else if (err instanceof ApiError && err.status === 409) {
        toast.error(t("claimed"));
      } else {
        toast.error(apiErrorMessage(err));
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="h-full border-dashed">
      <CardHeader>
        <span className="mb-1 flex size-9 items-center justify-center rounded-lg bg-muted">
          <TicketIcon className="size-4 text-muted-foreground" />
        </span>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-3" onSubmit={handleRedeem}>
          <Label htmlFor="invite-code" className="sr-only">
            {t("codeLabel")}
          </Label>
          <div className="flex gap-2">
            <Input
              id="invite-code"
              dir="ltr"
              placeholder={t("codePlaceholder")}
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              autoComplete="off"
              required
            />
            <Button type="submit" disabled={pending || code.trim().length === 0}>
              {pending ? <LoaderCircleIcon className="animate-spin" /> : null}
              {pending ? t("pending") : t("redeem")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
