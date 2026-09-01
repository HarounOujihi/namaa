import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { EraserIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { listAssets, uploadAsset } from "@/api";
import type { Asset } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/page-header";
import { SimpleSelect, type SelectOption } from "@/components/simple-select";
import { formatBytes, parseJsonObjectText, resolveAssetUrl } from "@/lib/format";
import { getErrorMessage, useQuery } from "@/lib/use-query";

const AUDIO_KEY_SUFFIX = "audioAssetId";

type PathSegment = string | number;

/**
 * A configuration location whose key ends with `audioAssetId`.
 * `parentSegments` + `key` describe the direct key-access walk used when
 * applying changes; `display` is presentation-only and never re-parsed.
 */
interface AudioPath {
  display: string;
  parentSegments: PathSegment[];
  key: string;
  currentId: string | null;
}

/** Pending decision for one path; `keep` leaves the configuration untouched. */
type Choice = { kind: "keep" } | { kind: "set"; assetId: string } | { kind: "clear" };

const KEEP: Choice = { kind: "keep" };

/** Renders a path segment, bracket-quoting keys that are not plain identifiers. */
function appendKey(display: string, key: string): string {
  return /^[A-Za-z0-9_$-]+$/.test(key) ? `${display}.${key}` : `${display}[${JSON.stringify(key)}]`;
}

function collectAudioPaths(
  node: unknown,
  parentSegments: PathSegment[],
  display: string,
  out: AudioPath[],
): void {
  if (Array.isArray(node)) {
    node.forEach((item, index) => {
      collectAudioPaths(item, [...parentSegments, index], `${display}[${index}]`, out);
    });
    return;
  }
  if (typeof node !== "object" || node === null) {
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    const childSegments = [...parentSegments, key];
    const childDisplay = appendKey(display, key);
    if (key.endsWith(AUDIO_KEY_SUFFIX)) {
      out.push({
        display: childDisplay,
        // Container path: parentSegments EXCLUDES the leaf key — applyChoice
        // walks here and assigns `key` on this object.
        parentSegments: parentSegments,
        key,
        currentId: typeof value === "string" && value !== "" ? value : null,
      });
    }
    collectAudioPaths(value, childSegments, childDisplay, out);
  }
}

/** Sets or removes one path's key on a cloned config tree via direct key access. */
function applyChoice(root: Record<string, unknown>, path: AudioPath, choice: Choice): void {
  if (choice.kind === "keep") {
    return;
  }
  let node: unknown = root;
  for (const segment of path.parentSegments) {
    node =
      typeof segment === "number"
        ? (node as unknown[])[segment]
        : (node as Record<string, unknown>)[segment];
    if (typeof node !== "object" || node === null) {
      return; // Containing object vanished — the config changed under us; skip.
    }
  }
  if (typeof node !== "object" || node === null) {
    return;
  }
  const container = node as Record<string, unknown>;
  if (choice.kind === "set") {
    container[path.key] = choice.assetId;
  } else {
    delete container[path.key];
  }
}

/** Truncates a UUID-style asset id for compact display in options and rows. */
function shortId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

interface AudioManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Live configuration JSON — the editor textarea's current value. */
  configJson: string;
  /** Receives the updated pretty-printed configuration JSON. */
  onApply: (newJson: string) => void;
}

export function AudioManagerDialog({
  open,
  onOpenChange,
  configJson,
  onApply,
}: AudioManagerDialogProps) {
  const [uploaded, setUploaded] = useState<Asset[]>([]);
  const [choices, setChoices] = useState<Map<string, Choice>>(() => new Map());
  // Mirror of `choices` that survives every render — handleApply must read
  // the live decisions, never a possibly-stale closure over state.
  const choicesRef = useRef<Map<string, Choice>>(new Map());
  const [uploadingPath, setUploadingPath] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const uploadTargetRef = useRef<string | null>(null);

  // Only hit the API while the dialog is actually open.
  const { data, loading, error, reload } = useQuery(
    () => (open ? listAssets("AUDIO") : Promise.resolve(null)),
    [open],
  );
  const assets = useMemo(() => {
    const fromApi = [...(data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return [...fromApi, ...uploaded];
  }, [data, uploaded]);
  const assetById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);

  // Every session starts from the configuration as it currently stands.
  useEffect(() => {
    if (open) {
      choicesRef.current = new Map();
      setChoices(new Map());
      setUploaded([]);
    }
  }, [open]);

  const [paths, configOk] = useMemo(() => {
    const result = parseJsonObjectText(configJson);
    if (!result.ok) {
      return [[], false] as const;
    }
    const out: AudioPath[] = [];
    collectAudioPaths(result.value, [], "$", out);
    return [out, true] as const;
  }, [configJson]);

  const pendingCount = paths.reduce(
    (count, path) => ((choices.get(path.display) ?? KEEP).kind === "keep" ? count : count + 1),
    0,
  );

  function setChoice(display: string, choice: Choice): void {
    choicesRef.current.set(display, choice);
    setChoices((prev) => {
      const next = new Map(prev);
      next.set(display, choice);
      return next;
    });
  }

  function assetOptions(): SelectOption[] {
    return assets.map((asset) => ({
      value: asset.id,
      label: `${shortId(asset.id)} · ${asset.mimeType}`,
    }));
  }

  async function handleUpload(path: AudioPath, file: File): Promise<void> {
    setUploadingPath(path.display);
    try {
      const result = await uploadAsset(file, "AUDIO");
      const asset: Asset = {
        id: result.id,
        type: result.type,
        mimeType: result.mimeType,
        sizeBytes: file.size,
        status: "READY",
        createdAt: new Date().toISOString(),
        url: result.url,
      };
      setUploaded((prev) => [...prev, asset]);
      setChoice(path.display, { kind: "set", assetId: asset.id });
      toast.success(`Audio uploaded (${asset.mimeType})`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUploadingPath(null);
    }
  }

  function handleApply(): void {
    const result = parseJsonObjectText(configJson);
    if (!result.ok) {
      toast.error("Configuration JSON is invalid — fix it in the editor first");
      return;
    }
    // Deep clone first: the parsed live configuration is never mutated in place.
    const nextConfig = structuredClone(result.value);
    for (const path of paths) {
      applyChoice(nextConfig, path, choicesRef.current.get(path.display) ?? KEEP);
    }
    onApply(JSON.stringify(nextConfig, null, 2));
    toast.success(
      `Audio assignments applied (${pendingCount} change${pendingCount === 1 ? "" : "s"})`,
    );
    onOpenChange(false);
  }

  function renderCurrent(path: AudioPath): ReactNode {
    const asset = path.currentId === null ? undefined : assetById.get(path.currentId);
    if (path.currentId === null) {
      return <p className="text-xs text-muted-foreground">unset — TTS fallback</p>;
    }
    if (asset === undefined) {
      return (
        <p className="text-xs text-muted-foreground">
          asset id <code className="font-mono">{path.currentId}</code> is not in the audio library
        </p>
      );
    }
    return (
      <div className="flex flex-wrap items-center gap-2">
        <audio
          controls
          preload="none"
          src={resolveAssetUrl(asset.url)}
          className="h-8 max-w-full"
        />
        <span className="text-xs text-muted-foreground">
          {asset.mimeType} · {formatBytes(asset.sizeBytes)} · {shortId(asset.id)}
        </span>
      </div>
    );
  }

  function renderRow(path: AudioPath): ReactNode {
    const choice = choices.get(path.display) ?? KEEP;
    const selectedAsset = choice.kind === "set" ? assetById.get(choice.assetId) : undefined;
    const uploading = uploadingPath === path.display;
    return (
      <li key={path.display} className="space-y-2 rounded-lg border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <code className="font-mono text-xs">{path.display}</code>
          {choice.kind !== "keep" ? (
            <Badge variant="secondary">
              {choice.kind === "set" ? "pending: set" : "pending: remove"}
            </Badge>
          ) : null}
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Current</p>
          {renderCurrent(path)}
        </div>
        {choice.kind === "set" ? (
          selectedAsset === undefined ? (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              selected asset is not in the audio library
            </p>
          ) : (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Selected (preview)</p>
              <div className="flex flex-wrap items-center gap-2">
                <audio
                  controls
                  preload="none"
                  src={resolveAssetUrl(selectedAsset.url)}
                  className="h-8 max-w-full"
                />
                <span className="text-xs text-muted-foreground">
                  {selectedAsset.mimeType} · {formatBytes(selectedAsset.sizeBytes)} ·{" "}
                  {shortId(selectedAsset.id)}
                </span>
              </div>
            </div>
          )
        ) : null}
        {choice.kind === "clear" ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            will be removed — the app speaks the text fallback (TTS)
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <SimpleSelect
            value={choice.kind === "set" ? choice.assetId : null}
            onValueChange={(assetId) =>
              setChoice(
                path.display,
                assetId === path.currentId ? KEEP : { kind: "set", assetId },
              )
            }
            options={assetOptions()}
            placeholder={assets.length === 0 ? "No audio assets" : "Select existing…"}
            disabled={assets.length === 0}
            size="sm"
            className="w-56"
            ariaLabel={`Select existing audio asset for ${path.display}`}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploadingPath !== null}
            onClick={() => {
              uploadTargetRef.current = path.display;
              uploadInputRef.current?.click();
            }}
          >
            <UploadIcon />
            {uploading ? "Uploading…" : "Upload new"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={choice.kind === "clear" || (path.currentId === null && choice.kind !== "set")}
            onClick={() => setChoice(path.display, { kind: "clear" })}
          >
            <EraserIcon />
            Clear
          </Button>
        </div>
      </li>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage exercise audio</DialogTitle>
          <DialogDescription>
            Attach recorded audio to every{" "}
            <code className="font-mono text-xs">*audioAssetId</code> field in this
            configuration. Clearing a field removes the asset id so the child app speaks the
            text fallback (TTS). Applied changes are written back to the JSON editor.
          </DialogDescription>
        </DialogHeader>
        <input
          ref={uploadInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            const target = uploadTargetRef.current;
            const path = target === null ? undefined : paths.find((p) => p.display === target);
            if (file !== undefined && path !== undefined) {
              void handleUpload(path, file);
            }
            event.target.value = "";
          }}
        />
        {!configOk ? (
          <ErrorState message="The configuration JSON is invalid — fix the errors in the editor first." />
        ) : error !== null ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : paths.length === 0 ? (
          <EmptyState
            title="No audio-capable fields"
            description={
              "This exercise configuration has no *audioAssetId fields. Add a key ending in " +
              "audioAssetId (for example $.prompt.audioAssetId) and reopen this dialog to attach " +
              "recorded audio."
            }
          />
        ) : (
          <ul className="space-y-3">{paths.map((path) => renderRow(path))}</ul>
        )}
        {configOk && paths.length > 0 ? (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleApply} disabled={pendingCount === 0}>
              {pendingCount === 0
                ? "Apply"
                : `Apply ${pendingCount} change${pendingCount === 1 ? "" : "s"}`}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
