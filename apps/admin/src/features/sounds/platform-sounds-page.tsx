import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { EmptyState, ErrorState, PageHeader } from "@/components/page-header";
import { SimpleSelect, type SelectOption } from "@/components/simple-select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import { listAppSounds, listAssets, updateAppSound, uploadAsset } from "@/api";
import type { AppSound } from "@/types";
import { formatBytes, formatDate, resolveAssetUrl } from "@/lib/format";
import { getErrorMessage, useQuery } from "@/lib/use-query";
import { toast } from "sonner";

const PLAY_CONTEXT: Record<string, string> = {
  WELCOME: "when a child profile is selected",
  CELEBRATION_CORRECT: "on a correct answer",
  ENCOURAGEMENT_RETRY: "gently on a wrong answer",
  STAGE_COMPLETE: "when all exercises in a stage are done",
};

interface SoundCardProps {
  sound: AppSound;
  assetOptions: readonly SelectOption[];
  busy: boolean;
  onBind: (sound: AppSound, assetId: string) => Promise<boolean>;
  onUpload: (sound: AppSound, file: File) => Promise<boolean>;
  onSaveText: (sound: AppSound, text: string) => Promise<boolean>;
  onUnbind: (sound: AppSound) => Promise<boolean>;
}

function SoundCard({
  sound,
  assetOptions,
  busy,
  onBind,
  onUpload,
  onSaveText,
  onUnbind,
}: SoundCardProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [confirmUnbind, setConfirmUnbind] = useState(false);
  const [text, setText] = useState(sound.textFallback);
  const [syncedText, setSyncedText] = useState(sound.textFallback);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (sound.textFallback !== syncedText) {
    setSyncedText(sound.textFallback);
    setText(sound.textFallback);
  }

  const playContext = PLAY_CONTEXT[sound.key] ?? "at an app-defined moment";
  const pickerOpen = showPicker || sound.asset === null;

  async function handleSelectAsset(assetId: string): Promise<void> {
    const ok = await onBind(sound, assetId);
    if (ok) {
      setShowPicker(false);
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files === null ? null : event.target.files[0];
    if (fileInputRef.current !== null) {
      fileInputRef.current.value = "";
    }
    if (file === null) {
      return;
    }
    const ok = await onUpload(sound, file);
    if (ok) {
      setShowPicker(false);
    }
  }

  async function handleSaveText(): Promise<void> {
    const trimmed = text.trim();
    const ok = await onSaveText(sound, trimmed);
    if (ok) {
      setText(trimmed);
    }
  }

  async function handleConfirmUnbind(): Promise<void> {
    const ok = await onUnbind(sound);
    if (ok) {
      setConfirmUnbind(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <span>{sound.label}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-normal text-muted-foreground">
            {sound.key}
          </span>
        </CardTitle>
        <CardDescription>Plays {playContext}.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sound.asset !== null ? (
          <div className="space-y-3">
            <audio controls preload="metadata" src={resolveAssetUrl(sound.asset.url)} className="h-10 w-full" />
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary">{sound.asset.mimeType}</Badge>
              <Badge variant="outline">{formatBytes(sound.asset.sizeBytes)}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={busy} onClick={() => setShowPicker((open) => !open)}>
                {pickerOpen ? "Cancel" : "Replace"}
              </Button>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => setConfirmUnbind(true)}>
                Unbind (use TTS)
              </Button>
            </div>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
            Not set — TTS speaks the fallback text
          </p>
        )}

        {pickerOpen ? (
          <div className="grid gap-3 rounded-lg border bg-muted/30 p-3">
            <div className="grid gap-1.5">
              <Label htmlFor={`sound-asset-${sound.key}`}>Audio asset</Label>
              <SimpleSelect
                id={`sound-asset-${sound.key}`}
                value={sound.asset === null ? null : sound.asset.id}
                onValueChange={(assetId) => void handleSelectAsset(assetId)}
                options={assetOptions}
                placeholder="Choose an uploaded audio file…"
                ariaLabel={`Audio asset for ${sound.label}`}
                disabled={busy || assetOptions.length === 0}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`sound-upload-${sound.key}`}>Or upload a new file</Label>
              <Input
                ref={fileInputRef}
                id={`sound-upload-${sound.key}`}
                type="file"
                accept="audio/*"
                disabled={busy}
                onChange={(event) => void handleFileChange(event)}
              />
            </div>
          </div>
        ) : null}

        <div className="grid gap-1.5">
          <Label htmlFor={`sound-text-${sound.key}`}>TTS fallback text (Arabic)</Label>
          <div className="flex gap-2">
            <Input
              id={`sound-text-${sound.key}`}
              dir="rtl"
              lang="ar"
              value={text}
              disabled={busy}
              onChange={(event) => setText(event.target.value)}
            />
            <Button
              disabled={busy || text === sound.textFallback || text.trim() === ""}
              onClick={() => void handleSaveText()}
            >
              Save
            </Button>
          </div>
        </div>
      </CardContent>

      <AlertDialog
        open={confirmUnbind}
        onOpenChange={(open) => (!open ? setConfirmUnbind(false) : undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unbind audio from &quot;{sound.label}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              The audio file stays in Assets. The child app will speak the Arabic fallback
              text instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={() => void handleConfirmUnbind()}
            >
              Unbind (use TTS)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export function PlatformSoundsPage() {
  const soundsQuery = useQuery(listAppSounds, []);
  const assetsQuery = useQuery(() => listAssets("AUDIO"), []);

  const [overrides, setOverrides] = useState<Record<string, AppSound>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const sounds =
    soundsQuery.data === null
      ? null
      : soundsQuery.data.map((sound) => overrides[sound.key] ?? sound);
  const busy = busyKey !== null;

  const assetOptions = useMemo<SelectOption[]>(
    () =>
      (assetsQuery.data ?? []).map((asset) => ({
        value: asset.id,
        label: asset.originalName !== null && asset.originalName !== ""
          ? `${asset.originalName} · ${asset.mimeType}`
          : `${asset.mimeType} · ${formatBytes(asset.sizeBytes)} · ${formatDate(asset.createdAt)}`,
      })),
    [assetsQuery.data],
  );

  async function runMutation(
    key: string,
    action: () => Promise<AppSound>,
    successMessage: string,
  ): Promise<boolean> {
    if (busyKey !== null) {
      return false;
    }
    setBusyKey(key);
    try {
      const updated = await action();
      setOverrides((current) => ({ ...current, [key]: updated }));
      toast.success(successMessage);
      return true;
    } catch (err) {
      toast.error(getErrorMessage(err));
      return false;
    } finally {
      setBusyKey(null);
    }
  }

  async function handleBind(sound: AppSound, assetId: string): Promise<boolean> {
    return runMutation(
      sound.key,
      () => updateAppSound(sound.key, { assetId }),
      `Audio bound to "${sound.label}"`,
    );
  }

  async function handleUpload(sound: AppSound, file: File): Promise<boolean> {
    const ok = await runMutation(
      sound.key,
      async () => {
        const uploaded = await uploadAsset(file, "AUDIO");
        return updateAppSound(sound.key, { assetId: uploaded.id });
      },
      `Audio uploaded and bound to "${sound.label}"`,
    );
    if (ok) {
      assetsQuery.reload();
    }
    return ok;
  }

  async function handleSaveText(sound: AppSound, text: string): Promise<boolean> {
    return runMutation(
      sound.key,
      () => updateAppSound(sound.key, { textFallback: text }),
      `Fallback text saved for "${sound.label}"`,
    );
  }

  async function handleUnbind(sound: AppSound): Promise<boolean> {
    return runMutation(
      sound.key,
      () => updateAppSound(sound.key, { assetId: null }),
      `"${sound.label}" now uses the TTS fallback`,
    );
  }

  return (
    <div>
      <PageHeader
        title="Platform Sounds"
        description="App-level audio with Arabic TTS fallback — used by the child app for welcome, celebration and encouragement moments."
      />
      {assetsQuery.error !== null ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <span>Could not load audio assets — you can still upload a file below.</span>
          <Button variant="outline" size="sm" onClick={assetsQuery.reload}>
            Retry
          </Button>
        </div>
      ) : null}

      {soundsQuery.error !== null ? (
        <ErrorState
          message={soundsQuery.error}
          onRetry={() => {
            setOverrides({});
            soundsQuery.reload();
          }}
        />
      ) : null}
      {soundsQuery.error === null && soundsQuery.loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1, 2, 3].map((cell) => (
            <Card key={cell}>
              <CardHeader>
                <Skeleton className="h-5 w-1/3" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-9 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
      {soundsQuery.error === null && !soundsQuery.loading && sounds !== null ? (
        sounds.length === 0 ? (
          <EmptyState
            title="No platform sounds"
            description="Expected sound slots (welcome, celebration, retry, stage complete) were not found."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {sounds.map((sound) => (
              <SoundCard
                key={sound.key}
                sound={sound}
                assetOptions={assetOptions}
                busy={busy}
                onBind={handleBind}
                onUpload={handleUpload}
                onSaveText={handleSaveText}
                onUnbind={handleUnbind}
              />
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}
