"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { CheckIcon, CopyIcon, LoaderCircleIcon, UserPlusIcon } from "lucide-react";
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
import { createChild } from "@/lib/api";
import { useApiErrorMessage } from "@/lib/format";
import type { CreateChildResult } from "@/lib/types";

export function AddChildCard({ onCreated }: { onCreated: () => void }) {
  const t = useTranslations("addChild");
  const apiErrorMessage = useApiErrorMessage();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [pending, setPending] = useState(false);
  const [copying, setCopying] = useState(false);
  const [result, setResult] = useState<CreateChildResult | null>(null);

  function closeDialog(nextOpen: boolean): void {
    if (!nextOpen) {
      setResult(null);
      setFullName("");
      setBirthDate("");
      setGradeLevel("");
    }
    setOpen(nextOpen);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending || fullName.trim().length === 0 || birthDate.length === 0) {
      return;
    }
    setPending(true);
    try {
      const created = await createChild({
        fullName: fullName.trim(),
        birthDate,
        gradeLevel: gradeLevel.trim().length > 0 ? gradeLevel.trim() : undefined,
      });
      setResult(created);
      toast.success(t("createdToast", { name: created.child.fullName }));
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function copyCode(): Promise<void> {
    if (result === null || copying) {
      return;
    }
    setCopying(true);
    try {
      await navigator.clipboard.writeText(result.inviteCode);
      toast.success(t("copied"));
    } catch {
      toast.error(t("copy"));
    } finally {
      setCopying(false);
    }
  }

  return (
    <>
      <Card className="h-full border-dashed">
        <CardHeader>
          <span className="mb-1 flex size-9 items-center justify-center rounded-lg bg-muted">
            <UserPlusIcon className="size-4 text-muted-foreground" />
          </span>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setOpen(true)}>
            <UserPlusIcon />
            {t("action")}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={closeDialog}>
        <DialogContent>
          {result === null ? (
            <>
              <DialogHeader>
                <DialogTitle>{t("title")}</DialogTitle>
                <DialogDescription>{t("description")}</DialogDescription>
              </DialogHeader>
              <form className="flex flex-col gap-4" onSubmit={handleCreate}>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="new-child-name">{t("fullName")}</Label>
                  <Input
                    id="new-child-name"
                    value={fullName}
                    placeholder={t("fullNamePlaceholder")}
                    onChange={(event) => setFullName(event.target.value)}
                    autoComplete="off"
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="new-child-birth">{t("birthDate")}</Label>
                  <Input
                    id="new-child-birth"
                    type="date"
                    value={birthDate}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(event) => setBirthDate(event.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="new-child-grade">{t("gradeLevel")}</Label>
                  <Input
                    id="new-child-grade"
                    value={gradeLevel}
                    onChange={(event) => setGradeLevel(event.target.value)}
                    autoComplete="off"
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={pending}>
                    {pending ? <LoaderCircleIcon className="animate-spin" /> : null}
                    {pending ? t("pending") : t("submit")}
                  </Button>
                </DialogFooter>
              </form>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{t("createdTitle")}</DialogTitle>
                <DialogDescription>{t("createdHint")}</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center gap-4 py-2">
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {t("codeLabel")}
                </span>
                <span
                  dir="ltr"
                  className="rounded-xl bg-muted px-6 py-3 font-mono text-2xl font-semibold tracking-[0.2em]"
                >
                  {result.inviteCode}
                </span>
                <Button variant="outline" onClick={() => void copyCode()} disabled={copying}>
                  {copying ? <LoaderCircleIcon className="animate-spin" /> : <CopyIcon />}
                  {t("copy")}
                </Button>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => {
                    onCreated();
                    closeDialog(false);
                  }}
                >
                  <CheckIcon />
                  {t("done")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
