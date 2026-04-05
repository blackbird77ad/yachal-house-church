import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import Loader from "./Loader";
import MustChangePassword from "../../pages/MustChangePassword";

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return <Loader fullScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.status === "pending") return <Navigate to="/pending" replace />;
  if (user.status === "suspended") return <Navigate to="/login" replace />;

  // Force password change before accessing any portal page
  if (user.mustChangePassword) return <MustChangePassword />;

  return children ? children : <Outlet />;
};

export default ProtectedRoute;