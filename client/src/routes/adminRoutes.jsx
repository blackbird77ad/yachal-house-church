import AdminDashboard from "../pages/admin/AdminDashboard";
import Branches from "../pages/admin/Branches";
import Workers from "../pages/admin/Workers";
import WorkerProfile from "../pages/admin/WorkerProfile";
import Reports from "../pages/admin/Reports";
import ReportDetail from "../pages/admin/ReportDetail";
import WorkerAnalysis from "../pages/admin/WorkerAnalysis";
import ReportTypes from "../pages/admin/ReportTypes";
import PortalControl from "../pages/admin/PortalControl";
import Qualification from "../pages/admin/Qualification";
import ServiceRoleQualification from "../pages/admin/ServiceRoleQualification";
import ProtectedRoute from "../components/common/ProtectedRoute";
import RoleGuard from "../components/common/RoleGuard";
import AllBranchOversightGuard from "../components/common/AllBranchOversightGuard";
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
      { path: "branches", element: <Branches /> },
      { path: "workers", element: <Workers /> },
      { path: "workers/:workerId", element: <WorkerProfile /> },
      { path: "reports", element: <Reports /> },
      { path: "reports/:reportId", element: <ReportDetail /> },
      { path: "worker-analysis", element: <WorkerAnalysis /> },
      { path: "report-types", element: <ReportTypes /> },
      { path: "portal", element: <AllBranchOversightGuard><PortalControl /></AllBranchOversightGuard> },
      { path: "qualification", element: <Qualification /> },
      { path: "service-roles", element: <ServiceRoleQualification /> },
    ],
  },
];

export default adminRoutes;
