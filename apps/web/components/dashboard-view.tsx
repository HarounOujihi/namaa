"use client";

import { useTranslations } from "next-intl";
import { AddChildCard } from "@/components/add-child-card";
import { ChildSummaryCard } from "@/components/child-summary-card";
import { InviteCard } from "@/components/invite-card";
import { SpecialistOverviewCard } from "@/components/specialist-overview-card";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/state-views";
import { getSpecialistOverview, listChildren } from "@/lib/api";
import { useApiErrorMessage } from "@/lib/format";
import type { AuthResponse } from "@/lib/types";
import { useQuery } from "@/lib/use-query";

function ParentDashboard() {
  const t = useTranslations("dashboard");
  const apiErrorMessage = useApiErrorMessage();
  const childrenQuery = useQuery(() => listChildren(), []);

  return (
    <>
      {childrenQuery.loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : childrenQuery.error !== null ? (
        <ErrorState
          message={apiErrorMessage(childrenQuery.error)}
          onRetry={childrenQuery.reload}
        />
      ) : (
        <>
          {childrenQuery.data !== null && childrenQuery.data.length === 0 ? (
            <EmptyState title={t("noChildrenTitle")} hint={t("noChildrenHint")} />
          ) : null}
          <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {childrenQuery.data?.map((child) => (
              <ChildSummaryCard key={child.id} child={child} />
            ))}
            <InviteCard onRedeemed={childrenQuery.reload} />
          </div>
        </>
      )}
    </>
  );
}

function SpecialistDashboard() {
  const t = useTranslations("dashboard");
  const apiErrorMessage = useApiErrorMessage();
  const overviewQuery = useQuery(() => getSpecialistOverview(), []);

  return (
    <>
      {overviewQuery.loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : overviewQuery.error !== null ? (
        <ErrorState
          message={apiErrorMessage(overviewQuery.error)}
          onRetry={overviewQuery.reload}
        />
      ) : (
        <>
          {overviewQuery.data !== null && overviewQuery.data.length === 0 ? (
            <EmptyState title={t("noCaseloadTitle")} hint={t("noCaseloadHint")} />
          ) : null}
          <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {overviewQuery.data?.map((row) => (
              <SpecialistOverviewCard key={row.childId} row={row} />
            ))}
            <AddChildCard onCreated={overviewQuery.reload} />
          </div>
        </>
      )}
    </>
  );
}

export function DashboardView({ auth }: { auth: AuthResponse }) {
  const t = useTranslations("dashboard");
  const isParent = auth.user.role === "PARENT";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">
          {t("greeting", { name: auth.user.fullName })}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {isParent ? t("subtitle") : t("specialistSubtitle")}
        </p>
      </div>
      {isParent ? <ParentDashboard /> : <SpecialistDashboard />}
    </div>
  );
}
