import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useSearchParams } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth-context";
import { pathOf, safeNext, withNext } from "./navigation";
import { CHILDREN_PATH } from "./play-views";
import { ChildPicker } from "./screens/ChildPicker";
import { LandingPage } from "./screens/LandingPage";
import { LoginScreen } from "./screens/LoginScreen";
import { AssessmentResultsRoute } from "./screens/assessment-results";
import { ActiveChildLayout } from "./screens/PlayLayout";
import {
  ActivityRoute,
  AssessmentRoute,
  CategoryRoute,
  JourneyRoute,
  PlayHomeRoute,
  RewardsRoute,
  StageRoute,
} from "./screens/PlayRoutes";

/** Public screens: a stored session skips them (to `?next=` when safe). */
function PublicOnly() {
  const { auth } = useAuth();
  const [params] = useSearchParams();
  if (auth !== null) {
    return <Navigate to={safeNext(params.get("next")) ?? CHILDREN_PATH} replace />;
  }
  return <Outlet />;
}

/** Everything past login: no session → `/login?next=<here>`. */
function RequireAuth() {
  const { auth } = useAuth();
  const location = useLocation();
  if (auth === null) {
    return <Navigate to={withNext("/login", pathOf(location))} replace />;
  }
  return <Outlet />;
}

export default function App() {
  return (
    // Synchronous location updates: a logout's navigate and its auth reset
    // land in one render, so the auth guard never sees the old path signed out.
    <BrowserRouter useTransitions={false}>
      <AuthProvider>
        <Routes>
          <Route element={<PublicOnly />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginScreen />} />
          </Route>
          <Route element={<RequireAuth />}>
            <Route path="/children" element={<ChildPicker />} />
            <Route path="/children/:childId/results" element={<AssessmentResultsRoute />} />
            <Route element={<ActiveChildLayout />}>
              <Route path="/play" element={<PlayHomeRoute />} />
              <Route path="/categories/:categoryId" element={<CategoryRoute />} />
              <Route path="/roadmaps/:roadmapId" element={<JourneyRoute />} />
              <Route path="/roadmaps/:roadmapId/stages/:stageOrder" element={<StageRoute />} />
              <Route
                path="/roadmaps/:roadmapId/stages/:stageOrder/activities/:itemOrder"
                element={<ActivityRoute />}
              />
              <Route path="/rewards" element={<RewardsRoute />} />
              <Route path="/assessment" element={<AssessmentRoute />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
