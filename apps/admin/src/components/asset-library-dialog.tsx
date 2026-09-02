import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { CircleCheckIcon, FileIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { listAssets, uploadAsset } from "@/api";
import type { Asset, AssetType } from "@/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { cn } from "@/lib/utils";
import { formatBytes, formatDate, resolveAssetUrl } from "@/lib/format";
import { getErrorMessage, useQuery } from "@/lib/use-query";

const FILTER_ALL = "__all__";

type LibraryFilter = typeof FILTER_ALL | "IMAGE" | "AUDIO" | "VIDEO";

const FILTER_LABELS: Record<LibraryFilter, string> = {
  [FILTER_ALL]: "All",
  IMAGE: "Image",
  AUDIO: "Audio",
  VIDEO: "Video",
};
const FILTER_ORDER: readonly LibraryFilter[] = [FILTER_ALL, "IMAGE", "AUDIO", "VIDEO"];

/** Maps a file MIME prefix to the asset type to upload as; null = unsupported. */
function inferAssetType(mimeType: string): "IMAGE" | "AUDIO" | null {
  if (mimeType.startsWith("image/")) {
    return "IMAGE";
  }
  if (mimeType.startsWith("audio/")) {
    return "AUDIO";
  }
  return null;
}

/** The upload input's `accept`: forced type, or image+audio when anything goes. */
function uploadAccept(type: AssetType | undefined): string | undefined {
  switch (type) {
    case "IMAGE":
      return "image/*";
    case "AUDIO":
      return "audio/*";
    case "VIDEO":
      return "video/*";
    case undefined:
      return "image/*,audio/*";
    default:
      return undefined;
  }
}

function AssetPreview({ asset }: { asset: Asset }) {
  if (asset.type === "IMAGE") {
    return (
      <img
        src={resolveAssetUrl(asset.url)}
        alt=""
        loading="lazy"
        className="aspect-video w-full rounded-lg border object-cover"
      />
    );
  }
  if (asset.type === "AUDIO") {
    return (
      // stopPropagation: interacting with the player must not (de)select the card.
      <div onClick={(event) => event.stopPropagation()}>
        <audio controls preload="none" src={resolveAssetUrl(asset.url)} className="h-8 w-full" />
      </div>
    );
  }
  return (
    <div className="flex aspect-video w-full items-center justify-center rounded-lg border bg-muted/40">
      <FileIcon className="size-8 text-muted-foreground" />
    </div>
  );
}

interface AssetCardProps {
  asset: Asset;
  selected: boolean;
  multiple: boolean;
  onToggle: (asset: Asset) => void;
}

function AssetCard({ asset, selected, multiple, onToggle }: AssetCardProps) {
  const fallbackName = asset.id.length > 8 ? `${asset.id.slice(0, 8)}…` : asset.id;
  const name =
    asset.originalName !== null && asset.originalName !== "" ? asset.originalName : fallbackName;
  const subtext = `${asset.mimeType} · ${formatBytes(asset.sizeBytes)} · ${formatDate(asset.createdAt)}`;
  const shell = cn(
    "relative rounded-lg border p-3 text-left transition-colors",
    selected ? "border-primary ring-2 ring-primary/40" : "hover:bg-muted/50",
  );
  const body: ReactNode = (
    <div className="space-y-2">
      <AssetPreview asset={asset} />
      <p className="truncate text-sm font-medium" title={name}>
        {name}
      </p>
      <p className="truncate text-xs text-muted-foreground" title={subtext}>
        {subtext}
      </p>
    </div>
  );

  if (multiple) {
    return (
      <div className={cn(shell, "cursor-pointer")} onClick={() => onToggle(asset)}>
        <div
          className="absolute top-2 right-2"
          onClick={(event) => event.stopPropagation()}
        >
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggle(asset)}
            aria-label={`Select ${name}`}
          />
        </div>
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        shell,
        "outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
      )}
      aria-pressed={selected}
      onClick={() => onToggle(asset)}
    >
      {selected ? (
        <CircleCheckIcon className="absolute top-2 right-2 size-5 text-primary" />
      ) : null}
      {body}
    </button>
  );
}

export interface AssetLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided: the type filter is forced, uploads use it and chips are hidden. */
  type?: AssetType;
  /** default false — single select highlights one card; multiple shows checkboxes. */
  multiple?: boolean;
  title?: string;
  /** Fires on Confirm with 1 (single) or N (multiple) assets; the dialog then closes. */
  onSelect: (assets: Asset[]) => void;
}

export function AssetLibraryDialog({
  open,
  onOpenChange,
  type,
  multiple = false,
  title = "Asset library",
  onSelect,
}: AssetLibraryDialogProps) {
  const [filter, setFilter] = useState<LibraryFilter>(FILTER_ALL);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  // Assets uploaded this session — merged over the fetched list until a refetch.
  const [extras, setExtras] = useState<Asset[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Only hit the API while the dialog is actually open.
  const queryType = type ?? (filter === FILTER_ALL ? undefined : filter);
  const { data, loading, error, reload } = useQuery(
    () => (open ? listAssets(queryType) : Promise.resolve(null)),
    [open, queryType],
  );

  // Every session starts fresh: selection, session uploads and the filter reset on open.
  useEffect(() => {
    if (open) {
      setSelected(new Set());
      setExtras([]);
      setFilter(FILTER_ALL);
    }
  }, [open]);

  const assets = useMemo(() => {
    const byId = new Map<string, Asset>();
    for (const asset of data ?? []) {
      byId.set(asset.id, asset);
    }
    for (const asset of extras) {
      byId.set(asset.id, asset);
    }
    return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [data, extras]);

  function toggle(asset: Asset): void {
    setSelected((prev) => {
      if (multiple) {
        const next = new Set(prev);
        if (next.has(asset.id)) {
          next.delete(asset.id);
        } else {
          next.add(asset.id);
        }
        return next;
      }
      return prev.has(asset.id) ? new Set() : new Set([asset.id]);
    });
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files === null ? undefined : event.target.files[0];
    if (fileInputRef.current !== null) {
      fileInputRef.current.value = "";
    }
    if (file === undefined) {
      return;
    }
    const effectiveType = type ?? inferAssetType(file.type);
    if (effectiveType === null) {
      toast.error("Unsupported file type — choose an image or audio file");
      return;
    }
    setUploading(true);
    try {
      const result = await uploadAsset(file, effectiveType);
      const asset: Asset = {
        id: result.id,
        originalName: result.originalName ?? file.name,
        type: result.type,
        mimeType: result.mimeType,
        sizeBytes: file.size,
        status: "READY",
        createdAt: new Date().toISOString(),
        url: result.url,
      };
      setExtras((prev) => [asset, ...prev]);
      setSelected((prev) => (multiple ? new Set([...prev, asset.id]) : new Set([asset.id])));
      toast.success(`Asset uploaded (${asset.mimeType})`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  function handleConfirm(): void {
    const chosen = assets.filter((asset) => selected.has(asset.id));
    if (chosen.length === 0) {
      return;
    }
    onSelect(chosen);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {multiple
              ? "Pick existing assets or upload new ones — choose as many as you need."
              : "Pick an existing asset or upload a new one."}
          </DialogDescription>
        </DialogHeader>
        <input
          ref={fileInputRef}
          type="file"
          accept={uploadAccept(type)}
          className="hidden"
          onChange={(event) => void handleFileChange(event)}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          {type === undefined ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {FILTER_ORDER.map((value) => (
                <Button
                  key={value}
                  type="button"
                  size="xs"
                  variant={filter === value ? "secondary" : "outline"}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {FILTER_LABELS[value]}
                </Button>
              ))}
            </div>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadIcon />
            {uploading ? "Uploading…" : "Upload new"}
          </Button>
        </div>
        {error !== null ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((cell) => (
              <Skeleton key={cell} className="h-40 w-full rounded-lg" />
            ))}
          </div>
        ) : assets.length === 0 ? (
          <EmptyState title="No assets yet — upload the first one" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {assets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                selected={selected.has(asset.id)}
                multiple={multiple}
                onToggle={toggle}
              />
            ))}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={selected.size === 0}>
            Confirm{multiple ? ` (${selected.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
