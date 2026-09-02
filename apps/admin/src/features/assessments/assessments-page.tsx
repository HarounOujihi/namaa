import { useState } from "react";
import { PageHeader, EmptyState, ErrorState } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
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
import { StatusBadge } from "@/components/status-badge";
import { listAssessments } from "@/api";
import type { AssessmentListItem, AssessmentListVersion } from "@/types";
import { useQuery } from "@/lib/use-query";
import { PlusIcon } from "lucide-react";
import { AssessmentCreateDialog } from "./assessment-create-dialog";
import { AssessmentDetail } from "./assessment-detail";

function latestListVersion(assessment: AssessmentListItem): AssessmentListVersion | null {
  return assessment.versions.reduce<AssessmentListVersion | null>(
    (latest, version) => (latest === null || version.version > latest.version ? version : latest),
    null,
  );
}

function VersionBadges({ versions }: { versions: AssessmentListVersion[] }) {
  const ordered = [...versions].sort((a, b) => b.version - a.version);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {ordered.map((version) => (
        <span key={version.id} className="flex items-center gap-1.5">
          <Badge variant="outline" className="font-mono">
            v{version.version}
          </Badge>
          <StatusBadge status={version.status} />
        </span>
      ))}
    </div>
  );
}

function AssessmentsTable({
  assessments,
  onOpen,
}: {
  assessments: AssessmentListItem[];
  onOpen: (id: string) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Assessment</TableHead>
          <TableHead>Versions</TableHead>
          <TableHead className="text-right">Items (latest)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {assessments.map((assessment) => {
          const latest = latestListVersion(assessment);
          return (
            <TableRow
              key={assessment.id}
              className="cursor-pointer"
              onClick={() => onOpen(assessment.id)}
            >
              <TableCell className="font-medium">{assessment.name}</TableCell>
              <TableCell>
                <VersionBadges versions={assessment.versions} />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {latest === null ? "—" : latest.itemCount}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function AssessmentList({ onOpen }: { onOpen: (id: string) => void }) {
  const { data, loading, error, reload } = useQuery(() => listAssessments(), []);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div>
      <PageHeader
        title="Assessments"
        description="Diagnostic assessments that determine each child's starting level per skill."
      >
        <Button onClick={() => setCreateOpen(true)}>
          <PlusIcon />
          New assessment
        </Button>
      </PageHeader>

      {error !== null ? <ErrorState message={error} onRetry={reload} /> : null}
      {error === null && loading ? (
        <Card className="p-4">
          <div className="space-y-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-2/3" />
          </div>
        </Card>
      ) : null}
      {error === null && !loading && data !== null ? (
        data.length === 0 ? (
          <EmptyState
            title="No assessments yet"
            description="Create a diagnostic assessment, add items to its draft version, then publish it."
          >
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <PlusIcon />
              New assessment
            </Button>
          </EmptyState>
        ) : (
          <Card className="overflow-hidden py-0">
            <AssessmentsTable assessments={data} onOpen={onOpen} />
          </Card>
        )
      ) : null}

      <AssessmentCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={onOpen}
      />
    </div>
  );
}

export function AssessmentsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (selectedId !== null) {
    return <AssessmentDetail assessmentId={selectedId} onBack={() => setSelectedId(null)} />;
  }
  return <AssessmentList onOpen={setSelectedId} />;
}
