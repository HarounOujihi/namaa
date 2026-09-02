import { useState } from "react";
import { PageHeader, ErrorState, EmptyState } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SimpleSelect } from "@/components/simple-select";
import { StatusBadge } from "@/components/status-badge";
import {
  ApiError,
  createAssessmentVersion,
  deleteAssessmentItem,
  getAssessment,
  publishAssessmentVersion,
} from "@/api";
import type {
  AssessmentDetail,
  AssessmentItem,
  AssessmentVersionDetail,
  JsonObject,
} from "@/types";
import { formatDate } from "@/lib/format";
import { getErrorMessage, useQuery } from "@/lib/use-query";
import {
  ArrowLeftIcon,
  ClipboardPenIcon,
  CopyPlusIcon,
  PencilIcon,
  PlusIcon,
  RocketIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { AssessmentItemDialog } from "./assessment-item-dialog";

type ItemDialogState = { item: AssessmentItem | null } | null;

interface AssessmentDetailProps {
  assessmentId: string;
  onBack: () => void;
}

function formatValidationErrors(err: ApiError): string {
  const details = err.validationErrors.map(
    (validationError) => `${validationError.path} — ${validationError.message}`,
  );
  return details.length === 0 ? err.message : `${err.message}: ${details.join("; ")}`;
}

function statusLabel(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function latestDetailVersion(assessment: AssessmentDetail): AssessmentVersionDetail | null {
  return assessment.versions.reduce<AssessmentVersionDetail | null>(
    (latest, version) => (latest === null || version.version > latest.version ? version : latest),
    null,
  );
}

function configSummary(configuration: JsonObject): string {
  const keys = Object.keys(configuration);
  if (keys.length === 0) {
    return "{}";
  }
  const compact = JSON.stringify(configuration);
  return compact.length > 60 ? `${compact.slice(0, 57)}…` : compact;
}

export function AssessmentDetail({ assessmentId, onBack }: AssessmentDetailProps) {
  const { data, loading, error, reload } = useQuery(
    () => getAssessment(assessmentId),
    [assessmentId],
  );
  const [versionId, setVersionId] = useState<string | null>(null);
  const [itemDialog, setItemDialog] = useState<ItemDialogState>(null);
  const [deleteTarget, setDeleteTarget] = useState<AssessmentItem | null>(null);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const versions = data?.versions ?? [];
  const currentVersion =
    versions.find((version) => version.id === versionId) ??
    (data === null ? null : latestDetailVersion(data));
  const isDraft = currentVersion?.status === "DRAFT";

  async function runMutation(action: () => Promise<void>, successMessage: string): Promise<void> {
    if (mutating) {
      return;
    }
    setMutating(true);
    setActionError(null);
    try {
      await action();
      toast.success(successMessage);
      reload();
    } catch (err) {
      setActionError(
        err instanceof ApiError && err.validationErrors.length > 0
          ? formatValidationErrors(err)
          : getErrorMessage(err),
      );
    } finally {
      setMutating(false);
    }
  }

  async function handlePublish(): Promise<void> {
    if (currentVersion === null) {
      return;
    }
    const version = currentVersion;
    setPublishConfirmOpen(false);
    await runMutation(async () => {
      await publishAssessmentVersion(version.id);
    }, `Version v${version.version} published`);
  }

  async function handleNewVersion(): Promise<void> {
    if (data === null) {
      return;
    }
    await runMutation(async () => {
      const detail = await createAssessmentVersion(data.id);
      const draft = latestDetailVersion(detail);
      if (draft !== null) {
        setVersionId(draft.id);
      }
    }, "New draft version created from the latest version");
  }

  async function handleDeleteItem(): Promise<void> {
    if (deleteTarget === null) {
      return;
    }
    const target = deleteTarget;
    setDeleteTarget(null);
    await runMutation(async () => {
      await deleteAssessmentItem(target.id);
    }, "Item removed from the draft version");
  }

  if (error !== null) {
    return (
      <div>
        <PageHeader
          title="Assessment"
          description="The assessment could not be loaded."
        >
          <Button variant="outline" onClick={onBack}>
            <ArrowLeftIcon />
            Back
          </Button>
        </PageHeader>
        <ErrorState message={error} onRetry={reload} />
      </div>
    );
  }

  if (loading || data === null) {
    return (
      <div>
        <PageHeader title="Assessment">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeftIcon />
            Back
          </Button>
        </PageHeader>
        <Card className="p-4">
          <div className="space-y-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-2/3" />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={data.name}
        description={`Diagnostic assessment · ${versions.length} version${versions.length === 1 ? "" : "s"}`}
      >
        <Button variant="outline" onClick={onBack}>
          <ArrowLeftIcon />
          Back
        </Button>
        {versions.length > 1 && currentVersion !== null ? (
          <SimpleSelect
            value={currentVersion.id}
            onValueChange={setVersionId}
            options={versions.map((version) => ({
              value: version.id,
              label: `v${version.version} — ${statusLabel(version.status)}`,
            }))}
            ariaLabel="Assessment version"
          />
        ) : null}
        {isDraft && currentVersion !== null ? (
          <>
            <Button variant="outline" onClick={() => setItemDialog({ item: null })} disabled={mutating}>
              <PlusIcon />
              Add item
            </Button>
            <Button onClick={() => setPublishConfirmOpen(true)} disabled={mutating}>
              <RocketIcon />
              Publish v{currentVersion.version}
            </Button>
          </>
        ) : null}
        {!isDraft && currentVersion !== null ? (
          <Button variant="outline" onClick={() => void handleNewVersion()} disabled={mutating}>
            <CopyPlusIcon />
            New version
          </Button>
        ) : null}
      </PageHeader>

      {currentVersion === null ? (
        <EmptyState
          title="No versions"
          description="This assessment has no versions yet."
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-4 py-3 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono">
                v{currentVersion.version}
              </Badge>
              <StatusBadge status={currentVersion.status} />
            </div>
            <span className="text-muted-foreground">
              {currentVersion.items.length} item{currentVersion.items.length === 1 ? "" : "s"}
            </span>
            {currentVersion.publishedAt !== null ? (
              <span className="text-muted-foreground">
                Published {formatDate(currentVersion.publishedAt)}
              </span>
            ) : null}
            {!isDraft ? (
              <span className="ml-auto text-muted-foreground">
                <ClipboardPenIcon className="mr-1 inline size-3.5 align-[-2px]" />
                Read-only — “New version” clones these items into an editable draft.
              </span>
            ) : null}
          </div>

          {currentVersion.items.length === 0 ? (
            <EmptyState
              title="No items in this version"
              description="Each assessment item runs a short exercise for one skill and feeds the child's starting level."
            >
              {isDraft ? (
                <Button size="sm" onClick={() => setItemDialog({ item: null })} disabled={mutating}>
                  <PlusIcon />
                  Add item
                </Button>
              ) : null}
            </EmptyState>
          ) : (
            <Card className="overflow-hidden py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Skill</TableHead>
                    <TableHead>Configuration</TableHead>
                    {isDraft ? (
                      <TableHead className="w-36 text-right">Actions</TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentVersion.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {item.order}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {item.typeCode}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{item.skill.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {item.skill.code}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[28rem]">
                        <div
                          className="truncate font-mono text-xs text-muted-foreground"
                          title={JSON.stringify(item.configuration, null, 2)}
                        >
                          {configSummary(item.configuration)}
                        </div>
                      </TableCell>
                      {isDraft ? (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setItemDialog({ item })}
                              disabled={mutating}
                            >
                              <PencilIcon />
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(item)}
                              disabled={mutating}
                            >
                              <Trash2Icon />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}

      {actionError !== null ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}

      {itemDialog !== null && currentVersion !== null ? (
        <AssessmentItemDialog
          assessmentVersionId={currentVersion.id}
          item={itemDialog.item}
          onClose={() => setItemDialog(null)}
          onChanged={reload}
        />
      ) : null}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => (!open ? setDeleteTarget(null) : undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove item?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the item from the draft version. Other versions keep their items.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDeleteItem()}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={publishConfirmOpen} onOpenChange={setPublishConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish v{currentVersion?.version}?</AlertDialogTitle>
            <AlertDialogDescription>
              Children will start receiving this version. Any currently published version will be
              archived.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handlePublish()}>Publish</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
