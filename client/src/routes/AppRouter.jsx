import { createBrowserRouter, RouterProvider, Outlet, Navigate } from "react-router-dom";
import PortalNavbar from "../components/common/PortalNavbar";
import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";
import Pending from "../pages/auth/Pending";
import WorkerDashboard from "../pages/portal/WorkerDashboard";
import SubmitReport from "../pages/portal/SubmitReport";
import MyProfile from "../pages/portal/MyProfile";
import MyReports from "../pages/portal/MyReports";
import MyReportDetail from "../pages/portal/MyReportDetail";
import WorkerRoster from "../pages/portal/WorkerRoster";
import Notifications from "../pages/portal/Notifications";
import FrontDesk from "../pages/portal/FrontDesk";
import AdminDashboard from "../pages/admin/AdminDashboard";
import Workers from "../pages/admin/Workers";
import WorkerProfile from "../pages/admin/WorkerProfile";
import Reports from "../pages/admin/Reports";
import ReportDetail from "../pages/admin/ReportDetail";
import ReportTypes from "../pages/admin/ReportTypes";
import PortalControl from "../pages/admin/PortalControl";
import Qualification from "../pages/admin/Qualification";
import RosterBuilder from "../pages/admin/RosterBuilder";
import AttendanceHistory from "../pages/admin/AttendanceHistory";
import NotFound from "../pages/NotFound";
import TourGuide from "../components/common/TourGuide";
import { RouteError } from "../components/common/ErrorBoundary";
import InstallPrompt from "../components/common/InstallPrompt";
import SupportFooter from "../components/common/SupportFooter";
import ProtectedRoute from "../components/common/ProtectedRoute";
import RoleGuard from "../components/common/RoleGuard";
import { ADMIN_ROLES } from "../utils/constants";

const AuthLayout = () => (
  <div className="min-h-screen bg-white dark:bg-slate-900">
    <Outlet />
  </div>
);

// Private portal with PortalNavbar only
const PrivateLayout = () => (
  <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-slate-900">
    <TourGuide />
    <InstallPrompt />
    <PortalNavbar />
    <main className="flex-1 page-container"><Outlet /></main>
    <SupportFooter />
  </div>
);

const router = createBrowserRouter([{
  errorElement: <RouteError />,
  children: [
  {
    element: <AuthLayout />,
    children: [
      { path: "/login", element: <Login /> },
      { path: "/register", element: <Register /> },
      { path: "/pending", element: <Pending /> },
    ],
  },
  {
    element: <ProtectedRoute><PrivateLayout /></ProtectedRoute>,
    children: [
      { path: "/portal/dashboard", element: <WorkerDashboard /> },
      { path: "/portal/submit-report", element: <SubmitReport /> },
      { path: "/portal/my-reports", element: <MyReports /> },
      { path: "/portal/my-reports/:reportId", element: <MyReportDetail /> },
      { path: "/portal/roster", element: <WorkerRoster /> },
      { path: "/portal/profile", element: <MyProfile /> },
      { path: "/portal/notifications", element: <Notifications /> },
      { path: "/portal/front-desk", element: <FrontDesk /> },
    ],
  },
  {
    element: <ProtectedRoute><RoleGuard allowedRoles={ADMIN_ROLES}><PrivateLayout /></RoleGuard></ProtectedRoute>,
    children: [
      { path: "/admin/dashboard", element: <AdminDashboard /> },
      { path: "/admin/workers", element: <Workers /> },
      { path: "/admin/workers/:workerId", element: <WorkerProfile /> },
      { path: "/admin/reports", element: <Reports /> },
      { path: "/admin/reports/:reportId", element: <ReportDetail /> },
      { path: "/admin/report-types", element: <ReportTypes /> },
      { path: "/admin/portal", element: <PortalControl /> },
      { path: "/admin/qualification", element: <Qualification /> },
      { path: "/admin/roster", element: <RosterBuilder /> },
      { path: "/admin/attendance", element: <AttendanceHistory /> },
    ],
  },
  { path: "/", element: <Navigate to="/login" replace /> },
  { path: "*", element: <NotFound /> },
]}]);

const AppRouter = () => <RouterProvider router={router} />;
export default AppRouter;