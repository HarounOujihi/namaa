import { useState } from "react";
import { PageHeader, EmptyState, ErrorState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listExerciseTypes } from "@/api";
import type { ExerciseTypeSummary } from "@/types";
import { formatDate } from "@/lib/format";
import { useQuery } from "@/lib/use-query";
import { PlusIcon } from "lucide-react";
import { ExerciseTypeCreateDialog } from "./exercise-type-create-dialog";
import { ExerciseTypeDetailSheet } from "./exercise-type-detail-sheet";

function ExerciseTypesTable({
  types,
  onOpen,
}: {
  types: ExerciseTypeSummary[];
  onOpen: (id: string) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Code</TableHead>
          <TableHead>Name</TableHead>
          <TableHead className="text-right">Versions</TableHead>
          <TableHead>Latest version</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {types.map((type) => (
          <TableRow
            key={type.id}
            className="cursor-pointer"
            onClick={() => onOpen(type.id)}
          >
            <TableCell className="font-mono text-xs">{type.code}</TableCell>
            <TableCell>
              <div className="max-w-[28rem] truncate font-medium">{type.name}</div>
              {type.description !== null ? (
                <div className="max-w-[28rem] truncate text-xs text-muted-foreground">
                  {type.description}
                </div>
              ) : null}
            </TableCell>
            <TableCell className="text-right tabular-nums">{type.versionsCount}</TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {type.latestVersion === null ? (
                "—"
              ) : (
                <span>
                  v{type.latestVersion.version} · {formatDate(type.latestVersion.createdAt)}
                </span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function ExerciseTypesPage() {
  const { data, loading, error, reload } = useQuery(() => listExerciseTypes(), []);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        title="Exercise Types"
        description="Blueprints that define the configuration schema for each kind of exercise."
      >
        <Button onClick={() => setCreateOpen(true)}>
          <PlusIcon />
          New exercise type
        </Button>
      </PageHeader>

      {error !== null ? <ErrorState message={error} onRetry={reload} /> : null}
      {error === null && loading ? (
        <Card className="p-4">
          <div className="space-y-3">
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-10 w-full" />
            ))}
          </div>
        </Card>
      ) : null}
      {error === null && !loading && data !== null ? (
        data.length === 0 ? (
          <EmptyState
            title="No exercise types yet"
            description="Create the first exercise type to start building the content library."
          >
            <Button onClick={() => setCreateOpen(true)}>
              <PlusIcon />
              New exercise type
            </Button>
          </EmptyState>
        ) : (
          <Card className="overflow-hidden py-0">
            <ExerciseTypesTable types={data} onOpen={setDetailId} />
          </Card>
        )
      ) : null}

      <ExerciseTypeCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={reload}
      />
      <ExerciseTypeDetailSheet
        typeId={detailId}
        onClose={() => setDetailId(null)}
        onChanged={reload}
      />
    </div>
  );
}
