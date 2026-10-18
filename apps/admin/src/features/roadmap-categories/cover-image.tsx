import { useRef, useState, type ChangeEvent } from "react";
import { ImageIcon, LibraryBigIcon, LoaderCircleIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { uploadAsset } from "@/api";
import { AssetLibraryDialog } from "@/components/asset-library-dialog";
import { Button } from "@/components/ui/button";
import { resolveAssetUrl } from "@/lib/format";
import { getErrorMessage } from "@/lib/use-query";
import { cn } from "@/lib/utils";

/** 16:9 cover image, or a soft placeholder when there is none. */
export function CoverImage({
  url,
  alt,
  className,
}: {
  url: string | null;
  alt: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden bg-gradient-to-br from-primary/10 via-muted to-primary/5",
        className,
      )}
    >
      {url === null ? (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/60">
          <ImageIcon className="size-1/4 max-h-10 max-w-10" aria-hidden />
          <span className="sr-only">No cover image</span>
        </div>
      ) : (
        <img
          src={resolveAssetUrl(url)}
          alt={alt}
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
        />
      )}
    </div>
  );
}

export interface CoverValue {
  assetId: string | null;
  url: string | null;
}

/** Cover picker: live 16:9 preview + upload new / pick from library / remove. */
export function CoverImageField({
  value,
  onChange,
  disabled = false,
}: {
  value: CoverValue;
  onChange: (next: CoverValue) => void;
  disabled?: boolean;
}) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files === null ? undefined : event.target.files[0];
    if (fileInputRef.current !== null) {
      fileInputRef.current.value = "";
    }
    if (file === undefined) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file");
      return;
    }
    setUploading(true);
    try {
      const result = await uploadAsset(file, "IMAGE");
      onChange({ assetId: result.id, url: result.url });
      toast.success("Cover image uploaded");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  const busy = disabled || uploading;

  return (
    <div className="grid gap-2">
      <div className="relative overflow-hidden rounded-lg border">
        <CoverImage url={value.url} alt="Cover preview" />
        {uploading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70 text-sm font-medium">
            <LoaderCircleIcon className="mr-2 size-4 animate-spin" />
            Uploading…
          </div>
        ) : null}
        {value.assetId !== null && value.url === null && !uploading ? (
          <p className="absolute inset-x-0 bottom-0 bg-background/80 px-2 py-1 text-center text-xs text-muted-foreground">
            Cover selected — preview unavailable
          </p>
        ) : null}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => void handleFileChange(event)}
      />
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadIcon />
          Upload
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => setLibraryOpen(true)}
        >
          <LibraryBigIcon />
          Library
        </Button>
        {value.assetId !== null ? (
          <Button
            type="button"
            variant="destructive"
            className="col-span-2 sm:ml-auto"
            disabled={busy}
            onClick={() => onChange({ assetId: null, url: null })}
          >
            <Trash2Icon />
            Remove cover
          </Button>
        ) : null}
      </div>
      <AssetLibraryDialog
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        type="IMAGE"
        title="Pick a cover image"
        onSelect={(assets) => {
          const picked = assets[0];
          if (picked !== undefined) {
            onChange({ assetId: picked.id, url: picked.url });
          }
        }}
      />
    </div>
  );
}
