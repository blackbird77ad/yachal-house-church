import AdminDashboard from "../pages/admin/AdminDashboard";
import Workers from "../pages/admin/Workers";
import WorkerProfile from "../pages/admin/WorkerProfile";
import Reports from "../pages/admin/Reports";
import ReportDetail from "../pages/admin/ReportDetail";
import ReportTypes from "../pages/admin/ReportTypes";
import PortalControl from "../pages/admin/PortalControl";
import Qualification from "../pages/admin/Qualification";
import ProtectedRoute from "../components/common/ProtectedRoute";
import RoleGuard from "../components/common/RoleGuard";
import { ADMIN_ROLES } from "../utils/constants";

const adminRoutes = [
  {
    path: "/admin",
    element: (
      <ProtectedRoute>
        <RoleGuard allowedRoles={ADMIN_ROLES} />
      </ProtectedRoute>
    ),
    children: [
      { path: "dashboard", element: <AdminDashboard /> },
      { path: "workers", element: <Workers /> },
      { path: "workers/:workerId", element: <WorkerProfile /> },
      { path: "reports", element: <Reports /> },
      { path: "reports/:reportId", element: <ReportDetail /> },
      { path: "report-types", element: <ReportTypes /> },
      { path: "portal", element: <PortalControl /> },
      { path: "qualification", element: <Qualification /> },
    ],
  },
];

export default adminRoutes;