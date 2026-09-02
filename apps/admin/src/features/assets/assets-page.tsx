import { useRef, useState, type ComponentType } from "react";
import { PageHeader, EmptyState, ErrorState } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { SimpleSelect } from "@/components/simple-select";
import { StatusBadge } from "@/components/status-badge";
import { listAssets, uploadAsset } from "@/api";
import { ASSET_TYPES, type Asset, type AssetType } from "@/types";
import { formatBytes, formatDate, resolveAssetUrl } from "@/lib/format";
import { getErrorMessage, useQuery } from "@/lib/use-query";
import {
  AudioLinesIcon,
  FilmIcon,
  Gamepad2Icon,
  ImageIcon,
  UploadIcon,
  VideoIcon,
} from "lucide-react";
import { toast } from "sonner";

const FILTER_ALL = "__all__";

const TYPE_ICONS: Record<AssetType, ComponentType<{ className?: string }>> = {
  IMAGE: ImageIcon,
  AUDIO: AudioLinesIcon,
  VIDEO: VideoIcon,
  ANIMATION: FilmIcon,
  GAME_ASSET: Gamepad2Icon,
};

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
  const Icon = TYPE_ICONS[asset.type];
  return (
    <div className="flex aspect-video w-full items-center justify-center rounded-lg border bg-muted/40">
      <Icon className="size-8 text-muted-foreground" />
    </div>
  );
}

export function AssetsPage() {
  const [typeFilter, setTypeFilter] = useState(FILTER_ALL);
  const { data, loading, error, reload } = useQuery(
    () => listAssets(typeFilter === FILTER_ALL ? undefined : (typeFilter as AssetType)),
    [typeFilter],
  );

  const [uploadType, setUploadType] = useState<AssetType>("IMAGE");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const typeOptions = [
    { value: FILTER_ALL, label: "All types" },
    ...ASSET_TYPES.map((type) => ({ value: type, label: type.toLowerCase() })),
  ];

  const accept =
    uploadType === "IMAGE"
      ? "image/*"
      : uploadType === "AUDIO"
        ? "audio/*"
        : uploadType === "VIDEO"
          ? "video/*"
          : undefined;

  async function handleUpload(): Promise<void> {
    if (file === null || uploading) {
      return;
    }
    setUploading(true);
    try {
      const result = await uploadAsset(file, uploadType);
      toast.success(`Asset uploaded (${result.mimeType})`);
      setFile(null);
      if (fileInputRef.current !== null) {
        fileInputRef.current.value = "";
      }
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Assets"
        description="Upload and browse media used by exercises across the platform."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Upload asset</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid min-w-56 flex-1 gap-1.5">
              <Label htmlFor="asset-file">File</Label>
              <Input
                ref={fileInputRef}
                id="asset-file"
                type="file"
                accept={accept}
                onChange={(event) => setFile(event.target.files === null ? null : event.target.files[0])}
              />
            </div>
            <div className="grid w-40 gap-1.5">
              <Label htmlFor="asset-type">Type</Label>
              <SimpleSelect
                id="asset-type"
                value={uploadType}
                onValueChange={(next) => setUploadType(next as AssetType)}
                options={ASSET_TYPES.map((type) => ({ value: type, label: type }))}
              />
            </div>
            <Button type="button" disabled={file === null || uploading} onClick={() => void handleUpload()}>
              <UploadIcon />
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="mb-4 flex items-center gap-2">
        <SimpleSelect
          value={typeFilter}
          onValueChange={setTypeFilter}
          options={typeOptions}
          ariaLabel="Filter assets by type"
          className="w-40"
          size="sm"
        />
        {data !== null ? (
          <span className="text-xs text-muted-foreground">
            {data.length} asset{data.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      {error !== null ? <ErrorState message={error} onRetry={reload} /> : null}
      {error === null && loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((cell) => (
            <Card key={cell}>
              <CardContent className="space-y-3">
                <Skeleton className="aspect-video w-full rounded-lg" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
      {error === null && !loading && data !== null ? (
        data.length === 0 ? (
          <EmptyState
            title={typeFilter === FILTER_ALL ? "No assets yet" : "No assets of this type"}
            description="Uploaded images, audio, video and game assets will appear here."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.map((asset) => (
              <Card key={asset.id}>
                <CardContent className="space-y-3">
                  <AssetPreview asset={asset} />
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary">{asset.type}</Badge>
                    <Badge variant="outline">{formatBytes(asset.sizeBytes)}</Badge>
                    <StatusBadge status={asset.status} />
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="truncate font-mono">{asset.originalName ?? asset.mimeType}</span>
                    <span className="shrink-0">{formatDate(asset.createdAt)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}
