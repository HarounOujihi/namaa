import { useEffect, useMemo, useState, type FormEvent } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { JsonEditor } from "@/components/json-editor";
import { ErrorState } from "@/components/page-header";
import { createExerciseTypeVersion, getExerciseType, updateExerciseType } from "@/api";
import type { ExerciseTypeDetail } from "@/types";
import { formatDate, parseJsonObjectText, toJsonText } from "@/lib/format";
import { getErrorMessage, useQuery } from "@/lib/use-query";
import { toast } from "sonner";

interface ExerciseTypeDetailSheetProps {
  typeId: string | null;
  onClose: () => void;
  onChanged: () => void;
}

function VersionList({ detail }: { detail: ExerciseTypeDetail }) {
  const versions = useMemo(
    () => [...detail.versions].sort((a, b) => b.version - a.version),
    [detail.versions],
  );
  return (
    <ul className="space-y-3">
      {versions.map((version) => (
        <li key={version.id} className="rounded-lg border">
          <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono">
                v{version.version}
              </Badge>
              {version.id === versions[0].id ? (
                <Badge variant="outline" className="text-emerald-700">
                  Latest
                </Badge>
              ) : null}
            </div>
            <span className="text-xs text-muted-foreground">{formatDate(version.createdAt)}</span>
          </div>
          <pre className="max-h-48 overflow-auto p-3 font-mono text-xs leading-relaxed text-muted-foreground">
            {toJsonText(version.configSchema)}
          </pre>
        </li>
      ))}
    </ul>
  );
}

export function ExerciseTypeDetailSheet({ typeId, onClose, onChanged }: ExerciseTypeDetailSheetProps) {
  const { data, loading, error, reload } = useQuery(
    () => getExerciseType(typeId as string),
    [typeId],
  );

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [detailsDirty, setDetailsDirty] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);

  const [newVersionOpen, setNewVersionOpen] = useState(false);
  const [newSchemaText, setNewSchemaText] = useState("{}");
  const [submittingVersion, setSubmittingVersion] = useState(false);
  const [versionError, setVersionError] = useState<string | null>(null);

  const schemaResult = parseJsonObjectText(newSchemaText);

  useEffect(() => {
    if (data !== null) {
      setName(data.name);
      setDescription(data.description ?? "");
      setDetailsDirty(false);
    }
  }, [data]);

  function openNewVersion(): void {
    setNewSchemaText(data === null ? "{}" : toJsonText(data.versions.at(-1)?.configSchema));
    setVersionError(null);
    setNewVersionOpen(true);
  }

  async function handleSaveDetails(): Promise<void> {
    if (data === null) {
      return;
    }
    setSavingDetails(true);
    try {
      await updateExerciseType(data.id, {
        name: name.trim(),
        description: description.trim() === "" ? null : description.trim(),
      });
      toast.success("Exercise type updated");
      setDetailsDirty(false);
      reload();
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingDetails(false);
    }
  }

  async function handleCreateVersion(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (data === null || !schemaResult.ok || submittingVersion) {
      return;
    }
    setSubmittingVersion(true);
    setVersionError(null);
    try {
      await createExerciseTypeVersion(data.id, schemaResult.value);
      toast.success(`Version ${data.versions.length + 1} created for ${data.code}`);
      setNewVersionOpen(false);
      reload();
      onChanged();
    } catch (err) {
      setVersionError(getErrorMessage(err));
    } finally {
      setSubmittingVersion(false);
    }
  }

  return (
    <Sheet open={typeId !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {data === null ? <Skeleton className="h-5 w-32" /> : data.name}
          </SheetTitle>
          <SheetDescription>
            {data === null ? (
              <Skeleton className="h-4 w-24" />
            ) : (
              <Badge variant="outline" className="font-mono">
                {data.code}
              </Badge>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-4">
          {error !== null ? <ErrorState message={error} onRetry={reload} /> : null}
          {error === null && loading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : null}
          {error === null && !loading && data !== null ? (
            <>
              <section className="space-y-3">
                <h3 className="text-sm font-medium">Details</h3>
                <div className="grid gap-2">
                  <Label htmlFor="type-detail-name">Name</Label>
                  <Input
                    id="type-detail-name"
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      setDetailsDirty(true);
                    }}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="type-detail-description">Description</Label>
                  <Textarea
                    id="type-detail-description"
                    value={description}
                    rows={2}
                    onChange={(event) => {
                      setDescription(event.target.value);
                      setDetailsDirty(true);
                    }}
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!detailsDirty || savingDetails}
                  onClick={() => void handleSaveDetails()}
                >
                  Save details
                </Button>
              </section>

              <Separator />

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">
                    Versions{" "}
                    <span className="text-muted-foreground">({data.versions.length})</span>
                  </h3>
                  <Button size="sm" onClick={openNewVersion}>
                    New version
                  </Button>
                </div>
                {data.versions.length === 0 ? (
                  <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                    No versions yet.
                  </p>
                ) : (
                  <VersionList detail={data} />
                )}
              </section>
            </>
          ) : null}
        </div>

        <Dialog open={newVersionOpen} onOpenChange={setNewVersionOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>New schema version</DialogTitle>
              <DialogDescription>
                Publishing a new schema version does not affect existing exercises; new edits will
                validate against it.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateVersion} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="new-version-schema">Config schema (JSON)</Label>
                <JsonEditor
                  id="new-version-schema"
                  value={newSchemaText}
                  onChange={setNewSchemaText}
                  error={schemaResult.ok ? null : schemaResult.error}
                  rows={12}
                />
              </div>
              {versionError !== null ? (
                <p className="text-sm text-destructive" role="alert">
                  {versionError}
                </p>
              ) : null}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setNewVersionOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!schemaResult.ok || submittingVersion}>
                  Create version
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}
