import { NavLink, Outlet } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  BrainIcon,
  ClipboardListIcon,
  DumbbellIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  PaperclipIcon,
  RouteIcon,
  ShapesIcon,
  UserIcon,
  Volume2Icon,
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboardIcon, end: true },
  { to: "/exercises", label: "Exercises", icon: DumbbellIcon },
  { to: "/exercise-types", label: "Exercise Types", icon: ShapesIcon },
  { to: "/assessments", label: "Assessments", icon: ClipboardListIcon },
  { to: "/roadmap", label: "Roadmap", icon: RouteIcon },
  { to: "/assets", label: "Assets", icon: PaperclipIcon },
  { to: "/sounds", label: "Platform Sounds", icon: Volume2Icon },
  { to: "/users", label: "Users", icon: UserIcon },
] as const;

function navLinkClass(isActive: boolean, compact: boolean): string {
  return cn(
    "flex items-center rounded-lg text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
    compact ? "size-9 justify-center" : "gap-2.5 px-3 py-2",
    isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
  );
}

export function AppShell() {
  const { auth, logout } = useAuth();
  const user = auth?.user;

  return (
    <div className="flex min-h-svh">
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex h-14 items-center gap-2.5 border-b px-4">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <BrainIcon className="size-4" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Dyslexia Therapy</p>
            <p className="text-xs text-muted-foreground">Super Admin CMS</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-2">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={"end" in item ? item.end : false} className={({ isActive }) => navLinkClass(isActive, false)}>
              <item.icon className="size-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <p className="px-4 pb-4 text-[0.68rem] text-muted-foreground">
          Signed in as {user === undefined ? "—" : user.email}
        </p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur lg:px-6">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground lg:hidden">
            <BrainIcon className="size-4" />
          </div>
          <nav className="flex min-w-0 flex-1 gap-1 overflow-x-auto lg:hidden">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={"end" in item ? item.end : false}
                aria-label={item.label}
                className={({ isActive }) => navLinkClass(isActive, true)}
              >
                <item.icon className="size-4" />
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <div className="hidden text-right leading-tight sm:block">
              <p className="text-sm font-medium">{user === undefined ? "—" : user.fullName}</p>
              <p className="text-xs text-muted-foreground">{user === undefined ? "" : user.email}</p>
            </div>
            <Badge variant="secondary" className="hidden sm:inline-flex">
              Super Admin
            </Badge>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOutIcon />
              Log out
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
