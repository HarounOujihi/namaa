import { useEffect, useState } from "react";
import { EmptyState, ErrorState, PageHeader } from "@/components/page-header";
import { SimpleSelect } from "@/components/simple-select";
import { StatusBadge } from "@/components/status-badge";
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
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listUsers, setUserActive } from "@/api";
import type { AdminUser, Role } from "@/types";
import { formatDate } from "@/lib/format";
import { getErrorMessage, useQuery } from "@/lib/use-query";
import { cn } from "@/lib/utils";
import { EllipsisIcon, KeyRoundIcon, PlusIcon, SearchIcon, UserCheckIcon, UserXIcon } from "lucide-react";
import { toast } from "sonner";
import { ResetPasswordDialog } from "./reset-password-dialog";
import { ROLE_BADGE_CLASS, ROLE_LABEL, ROLE_OPTIONS } from "./roles";
import { UserCreateDialog } from "./user-create-dialog";

const FILTER_ALL = "__all__";

const ROLE_FILTER_OPTIONS = [{ value: FILTER_ALL, label: "All roles" }, ...ROLE_OPTIONS];

function RoleBadge({ role }: { role: Role }) {
  return (
    <Badge variant="outline" className={ROLE_BADGE_CLASS[role]}>
      {ROLE_LABEL[role]}
    </Badge>
  );
}

export function UsersPage() {
  const [roleFilter, setRoleFilter] = useState<Role | typeof FILTER_ALL>(FILTER_ALL);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [resetFor, setResetFor] = useState<AdminUser | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<AdminUser | null>(null);
  const [mutating, setMutating] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const {
    data: users,
    loading,
    error,
    reload,
  } = useQuery(
    () =>
      listUsers({
        q: query === "" ? undefined : query,
        role: roleFilter === FILTER_ALL ? undefined : roleFilter,
      }),
    [roleFilter, query],
  );

  async function handleSetActive(user: AdminUser, active: boolean): Promise<void> {
    try {
      const updated = await setUserActive(user.id, active);
      toast.success(`${updated.email} ${active ? "reactivated" : "deactivated"}`);
      reload();
    } catch (err) {
      // e.g. "You cannot deactivate your own account"
      toast.error(getErrorMessage(err));
    }
  }

  async function handleConfirmDeactivate(): Promise<void> {
    if (confirmDeactivate === null || mutating) {
      return;
    }
    setMutating(true);
    try {
      await handleSetActive(confirmDeactivate, false);
    } finally {
      setMutating(false);
      setConfirmDeactivate(null);
    }
  }

  const hasFilters = roleFilter !== FILTER_ALL || query !== "";

  return (
    <div>
      <PageHeader
        title="Users"
        description="Manage platform accounts: create users, reset passwords and control access."
      >
        <Button onClick={() => setCreateOpen(true)}>
          <PlusIcon />
          New user
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SimpleSelect
          value={roleFilter}
          onValueChange={(next) => setRoleFilter(next as Role | typeof FILTER_ALL)}
          options={ROLE_FILTER_OPTIONS}
          ariaLabel="Filter by role"
          className="w-40"
        />
        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by email or name…"
            className="pl-8"
            aria-label="Search users by email or name"
          />
        </div>
      </div>

      {error !== null ? <ErrorState message={error} onRetry={reload} /> : null}
      {error === null && loading ? (
        <Card className="p-4">
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((row) => (
              <Skeleton key={row} className="h-10 w-full" />
            ))}
          </div>
        </Card>
      ) : null}
      {error === null && !loading && users !== null ? (
        users.length === 0 ? (
          <EmptyState
            title={hasFilters ? "No users match the filters" : "No users yet"}
            description={
              hasFilters
                ? "Try clearing the filters or refining your search."
                : "Create the first account to grant access to the platform."
            }
          />
        ) : (
          <Card className="overflow-hidden py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} className={cn(!user.isActive && "opacity-60")}>
                    <TableCell className="max-w-56 truncate font-medium">{user.fullName}</TableCell>
                    <TableCell className="max-w-64 truncate">{user.email}</TableCell>
                    <TableCell>
                      <RoleBadge role={user.role} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={user.isActive ? "ACTIVE" : "INACTIVE"} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(user.createdAt)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon-sm" aria-label="Row actions" />
                          }
                        >
                          <EllipsisIcon />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setResetFor(user)}>
                            <KeyRoundIcon />
                            Reset password
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {user.isActive ? (
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setConfirmDeactivate(user)}
                            >
                              <UserXIcon />
                              Deactivate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => void handleSetActive(user, true)}>
                              <UserCheckIcon />
                              Reactivate
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )
      ) : null}

      <UserCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={reload}
      />

      <ResetPasswordDialog user={resetFor} onOpenChange={(open) => (!open ? setResetFor(null) : undefined)} />

      <AlertDialog
        open={confirmDeactivate !== null}
        onOpenChange={(open) => (!open ? setConfirmDeactivate(null) : undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate this user?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDeactivate === null
                ? ""
                : `${confirmDeactivate.email} will no longer be able to sign in until the account is reactivated.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={mutating} onClick={() => void handleConfirmDeactivate()}>
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
