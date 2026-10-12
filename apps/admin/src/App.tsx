import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/app-shell";
import { LoginPage } from "@/features/auth/login-page";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { ExerciseTypesPage } from "@/features/exercise-types/exercise-types-page";
import { ExercisesPage } from "@/features/exercises/exercises-page";
import { AssessmentsPage } from "@/features/assessments/assessments-page";
import { RoadmapPage } from "@/features/roadmap/roadmap-page";
import { AssetsPage } from "@/features/assets/assets-page";
import { PlatformSoundsPage } from "@/features/sounds/platform-sounds-page";
import { UsersPage } from "@/features/users/users-page";
import { AuthProvider, useAuth } from "@/lib/auth";

function RequireAuth({ children }: { children: React.ReactElement }) {
  const { auth } = useAuth();
  if (auth === null) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="exercises" element={<ExercisesPage />} />
            <Route path="exercise-types" element={<ExerciseTypesPage />} />
            <Route path="assessments" element={<AssessmentsPage />} />
            <Route path="roadmaps" element={<RoadmapPage />} />
            <Route path="assets" element={<AssetsPage />} />
            <Route path="sounds" element={<PlatformSoundsPage />} />
            <Route path="users" element={<UsersPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster richColors closeButton />
      </BrowserRouter>
    </AuthProvider>
  );
}
