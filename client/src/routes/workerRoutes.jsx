import WorkerDashboard from "../pages/portal/WorkerDashboard";
import SubmitReport from "../pages/portal/SubmitReport";
import MyProfile from "../pages/portal/MyProfile";
import Notifications from "../pages/portal/Notifications";
import ProtectedRoute from "../components/common/ProtectedRoute";

const workerRoutes = [
  {
    path: "/portal",
    element: <ProtectedRoute />,
    children: [
      { path: "dashboard", element: <WorkerDashboard /> },
      { path: "submit-report", element: <SubmitReport /> },
      { path: "profile", element: <MyProfile /> },
      { path: "notifications", element: <Notifications /> },
    ],
  },
];

export default workerRoutes;