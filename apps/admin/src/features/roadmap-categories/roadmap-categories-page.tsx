import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  LayersIcon,
  LoaderCircleIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import {
  createRoadmapCategory,
  deleteRoadmapCategory,
  listRoadmapCategories,
  updateRoadmapCategory,
} from "@/api";
import type { AdminRoadmapCategory, RoadmapCategoryUpdatePayload } from "@/types";
import { EmptyState, ErrorState } from "@/components/page-header";
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
import { Card, CardTitle } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage, useQuery } from "@/lib/use-query";
import { cn } from "@/lib/utils";
import { CoverImage, CoverImageField, type CoverValue } from "./cover-image";
import { swapOrderUpdates } from "./ordering";

const NAME_MIN = 2;
const NAME_MAX = 80;
const DESCRIPTION_MAX = 300;

interface CategoryFormErrors {
  name?: string;
  description?: string;
}

function validateCategory(name: string, description: string): CategoryFormErrors {
  const errors: CategoryFormErrors = {};
  const trimmedName = name.trim();
  if (trimmedName.length < NAME_MIN) {
    errors.name = `Name must be at least ${NAME_MIN} characters.`;
  } else if (trimmedName.length > NAME_MAX) {
    errors.name = `Name must be at most ${NAME_MAX} characters.`;
  }
  if (description.trim().length > DESCRIPTION_MAX) {
    errors.description = `Description must be at most ${DESCRIPTION_MAX} characters.`;
  }
  return errors;
}

function CategoryDialog({
  open,
  category,
  nextOrder,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** null = create mode. */
  category: AdminRoadmapCategory | null;
  nextOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cover, setCover] = useState<CoverValue>({ assetId: null, url: null });
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setName(category?.name ?? "");
    setDescription(category?.description ?? "");
    setCover({ assetId: category?.coverAssetId ?? null, url: category?.coverUrl ?? null });
    setSubmitted(false);
  }, [open, category]);

  const errors = validateCategory(name, description);
  const hasErrors = errors.name !== undefined || errors.description !== undefined;
  const descriptionLength = description.trim().length;

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitted(true);
    if (hasErrors || pending) {
      return;
    }
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    setPending(true);
    try {
      if (category === null) {
        await createRoadmapCategory({
          name: trimmedName,
          description: trimmedDescription === "" ? undefined : trimmedDescription,
          coverAssetId: cover.assetId ?? undefined,
          order: nextOrder,
        });
        toast.success(`Category "${trimmedName}" created`);
      } else {
        const payload: RoadmapCategoryUpdatePayload = {};
        if (trimmedName !== category.name) {
          payload.name = trimmedName;
        }
        const nextDescription = trimmedDescription === "" ? null : trimmedDescription;
        if (nextDescription !== category.description) {
          payload.description = nextDescription;
        }
        if (cover.assetId !== category.coverAssetId) {
          payload.coverAssetId = cover.assetId;
        }
        if (Object.keys(payload).length > 0) {
          await updateRoadmapCategory(category.id, payload);
          toast.success(`Category "${trimmedName}" updated`);
        }
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!next && !pending ? onClose() : undefined)}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{category === null ? "New category" : "Edit category"}</DialogTitle>
          <DialogDescription>
            Categories group roadmaps on the child app&apos;s home screen.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" noValidate onSubmit={(event) => void handleSubmit(event)}>
          <div className="grid gap-1.5">
            <Label htmlFor="category-name">Name</Label>
            <Input
              id="category-name"
              value={name}
              maxLength={NAME_MAX}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={submitted && errors.name !== undefined}
              aria-describedby={submitted && errors.name !== undefined ? "category-name-error" : undefined}
              autoFocus
            />
            {submitted && errors.name !== undefined ? (
              <p id="category-name-error" className="text-xs text-destructive">
                {errors.name}
              </p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="category-description">Description (optional)</Label>
              <span
                className={cn(
                  "text-xs tabular-nums text-muted-foreground",
                  descriptionLength > DESCRIPTION_MAX && "text-destructive",
                )}
              >
                {descriptionLength}/{DESCRIPTION_MAX}
              </span>
            </div>
            <Textarea
              id="category-description"
              value={description}
              rows={3}
              className="max-h-40"
              onChange={(event) => setDescription(event.target.value)}
              aria-invalid={submitted && errors.description !== undefined}
            />
            {submitted && errors.description !== undefined ? (
              <p className="text-xs text-destructive">{errors.description}</p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <span className="text-sm leading-none font-medium">Cover image (optional)</span>
            <CoverImageField value={cover} onChange={setCover} disabled={pending} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || (submitted && hasErrors)}>
              {pending ? <LoaderCircleIcon className="animate-spin" /> : null}
              {category === null
                ? pending
                  ? "Creating…"
                  : "Create"
                : pending
                  ? "Saving…"
                  : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CategoryCard({
  category,
  isFirst,
  isLast,
  busy,
  onEdit,
  onDelete,
  onMove,
}: {
  category: AdminRoadmapCategory;
  isFirst: boolean;
  isLast: boolean;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  return (
    <Card className="gap-0 py-0">
      <div className="relative">
        <CoverImage url={category.coverUrl} alt={`${category.name} cover`} />
        <Badge
          variant="secondary"
          className="absolute top-2 left-2 bg-background/90 tabular-nums shadow-sm backdrop-blur"
        >
          #{category.order}
        </Badge>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 px-4 py-3">
        <CardTitle className="truncate text-base font-semibold" title={category.name}>
          {category.name}
        </CardTitle>
        {category.description === null || category.description === "" ? (
          <p className="text-sm text-muted-foreground italic">No description</p>
        ) : (
          <p className="line-clamp-2 text-sm text-muted-foreground" title={category.description}>
            {category.description}
          </p>
        )}
        <p className="mt-auto flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
          <LayersIcon className="size-3.5" />
          {category.roadmapCount} {category.roadmapCount === 1 ? "roadmap" : "roadmaps"}
        </p>
      </div>
      <div className="flex items-center gap-1 border-t bg-muted/40 px-3 py-2">
        <Button type="button" variant="outline" disabled={busy} onClick={onEdit}>
          <PencilIcon />
          Edit
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          aria-label={`Delete ${category.name}`}
          disabled={busy}
          onClick={onDelete}
        >
          <Trash2Icon />
        </Button>
        <div className="ml-auto flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Move ${category.name} up`}
            disabled={isFirst || busy}
            onClick={() => onMove(-1)}
          >
            <ChevronUpIcon />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Move ${category.name} down`}
            disabled={isLast || busy}
            onClick={() => onMove(1)}
          >
            <ChevronDownIcon />
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function RoadmapCategoriesPage() {
  const { data, loading, error, reload } = useQuery(() => listRoadmapCategories(), []);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminRoadmapCategory | null>(null);
  const [deleting, setDeleting] = useState<AdminRoadmapCategory | null>(null);
  const [busy, setBusy] = useState(false);

  const categories = useMemo(
    () =>
      data === null
        ? null
        : [...data].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)),
    [data],
  );
  const nextOrder =
    categories === null || categories.length === 0
      ? 1
      : Math.max(...categories.map((category) => category.order)) + 1;

  function openCreate(): void {
    setEditing(null);
    setDialogOpen(true);
  }

  async function handleMove(index: number, direction: -1 | 1): Promise<void> {
    if (categories === null || busy) {
      return;
    }
    const current = categories[index];
    const target = categories[index + direction];
    if (current === undefined || target === undefined) {
      return;
    }
    setBusy(true);
    try {
      for (const update of swapOrderUpdates(categories, current.id, target.id)) {
        await updateRoadmapCategory(update.id, { order: update.order });
      }
      toast.success("Category order updated");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
      reload();
    }
  }

  async function handleDelete(category: AdminRoadmapCategory): Promise<void> {
    setBusy(true);
    try {
      await deleteRoadmapCategory(category.id);
      toast.success(`Category "${category.name}" deleted`);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
      setDeleting(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="sticky top-14 z-10 -mx-4 mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-background/95 px-4 py-3 backdrop-blur lg:-mx-6 lg:h-16 lg:flex-nowrap lg:items-center lg:px-6 lg:py-0">
        <div className="min-w-0 flex-1 basis-40">
          <h1 className="text-lg font-semibold tracking-tight">Categories</h1>
          <p className="hidden truncate text-xs text-muted-foreground sm:block">
            Group roadmaps into categories children browse in the app.
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
          <Button type="button" variant="outline" onClick={reload} disabled={loading}>
            <RefreshCwIcon className={cn(loading && "animate-spin")} />
            Refresh
          </Button>
          <Button type="button" onClick={openCreate}>
            <PlusIcon />
            New category
          </Button>
        </div>
      </div>

      {error !== null ? <ErrorState message={error} onRetry={reload} /> : null}
      {error === null && loading && categories === null ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((cell) => (
            <Skeleton key={cell} className="aspect-[4/3] w-full rounded-xl" />
          ))}
        </div>
      ) : null}
      {error === null && categories !== null ? (
        categories.length === 0 ? (
          <EmptyState
            title="No categories yet"
            description="Create categories to group roadmaps for children. Roadmaps without a category stay uncategorized."
          >
            <Button type="button" onClick={openCreate}>
              <PlusIcon />
              New category
            </Button>
          </EmptyState>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {categories.map((category, index) => (
              <CategoryCard
                key={category.id}
                category={category}
                isFirst={index === 0}
                isLast={index === categories.length - 1}
                busy={busy || loading}
                onEdit={() => {
                  setEditing(category);
                  setDialogOpen(true);
                }}
                onDelete={() => setDeleting(category)}
                onMove={(direction) => void handleMove(index, direction)}
              />
            ))}
          </div>
        )
      ) : null}

      <CategoryDialog
        open={dialogOpen}
        category={editing}
        nextOrder={nextOrder}
        onClose={() => setDialogOpen(false)}
        onSaved={reload}
      />

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => (!open && !busy ? setDeleting(null) : undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting === null || deleting.roadmapCount === 0
                ? "This category has no roadmaps. "
                : `Its ${deleting.roadmapCount} ${deleting.roadmapCount === 1 ? "roadmap becomes" : "roadmaps become"} uncategorized — the roadmaps themselves are not deleted. `}
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={() => {
                if (deleting !== null) {
                  void handleDelete(deleting);
                }
              }}
            >
              {busy ? <LoaderCircleIcon className="animate-spin" /> : null}
              Delete category
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
