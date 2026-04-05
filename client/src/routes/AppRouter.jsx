import { createBrowserRouter, RouterProvider, Outlet } from "react-router-dom";
import Navbar from "../components/common/Navbar";
import PortalNavbar from "../components/common/PortalNavbar";
import Footer from "../components/common/Footer";
import SmartHome from "../pages/SmartHome";
import ServiceTimes from "../pages/public/ServiceTimes";
import Location from "../pages/public/Location";
import Contact from "../pages/public/Contact";
import Media from "../pages/public/Media";
import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";
import Pending from "../pages/auth/Pending";
import WorkerDashboard from "../pages/portal/WorkerDashboard";
import SubmitReport from "../pages/portal/SubmitReport";
import MyProfile from "../pages/portal/MyProfile";
import MyReports from "../pages/portal/MyReports";
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
import NotFound from "../pages/NotFound";
import ProtectedRoute from "../components/common/ProtectedRoute";
import RoleGuard from "../components/common/RoleGuard";
import { ADMIN_ROLES } from "../utils/constants";

// Public pages with Navbar + Footer
const PublicLayout = () => (
  <div className="min-h-screen flex flex-col bg-white dark:bg-slate-900">
    <Navbar />
    <main className="flex-1"><Outlet /></main>
    <Footer />
  </div>
);

// Auth pages - completely bare, no navbar, no footer
const AuthLayout = () => (
  <div className="min-h-screen bg-white dark:bg-slate-900">
    <Outlet />
  </div>
);

// Private portal with PortalNavbar only
const PrivateLayout = () => (
  <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-slate-900">
    <PortalNavbar />
    <main className="flex-1 page-container"><Outlet /></main>
  </div>
);

const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: "/", element: <SmartHome /> },
      { path: "/service-times", element: <ServiceTimes /> },
      { path: "/location", element: <Location /> },
      { path: "/contact", element: <Contact /> },
      { path: "/media", element: <Media /> },
    ],
  },
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
    ],
  },
  { path: "*", element: <NotFound /> },
]);

const AppRouter = () => <RouterProvider router={router} />;
export default AppRouter;