import type { ComponentType } from "react";
import { PageHeader, ErrorState } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getStats } from "@/api";
import type { AdminStats } from "@/types";
import { useQuery } from "@/lib/use-query";
import {
  BrainIcon,
  CircleCheckIcon,
  DumbbellIcon,
  FilePenIcon,
  PaperclipIcon,
  RouteIcon,
  ShapesIcon,
} from "lucide-react";

interface StatCardSpec {
  key: keyof AdminStats;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

const STAT_CARDS: readonly StatCardSpec[] = [
  { key: "skills", label: "Skills", icon: BrainIcon },
  { key: "exerciseTypes", label: "Exercise Types", icon: ShapesIcon },
  { key: "exercises", label: "Exercises", icon: DumbbellIcon },
  { key: "published", label: "Published", icon: CircleCheckIcon },
  { key: "drafts", label: "Drafts", icon: FilePenIcon },
  { key: "assets", label: "Assets", icon: PaperclipIcon },
  { key: "roadmaps", label: "Roadmaps", icon: RouteIcon },
];

export function DashboardPage() {
  const { data, loading, error, reload } = useQuery(() => getStats(), []);

  return (
    <div>
      <PageHeader title="Dashboard" description="Overview of platform content and activity." />
      {error !== null ? <ErrorState message={error} onRetry={reload} /> : null}
      {error === null && loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STAT_CARDS.map((card) => (
            <Card key={card.key}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
      {error === null && !loading && data !== null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STAT_CARDS.map((card) => (
            <Card key={card.key}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {card.label}
                  </CardTitle>
                  <card.icon className="size-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">{data[card.key]}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
