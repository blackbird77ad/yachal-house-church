import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import Home from "./public/Home";
import Loader from "../components/common/Loader";

const SmartHome = () => {
  const { user, loading } = useAuth();

  if (loading) return <Loader fullScreen />;

  if (user) {
    if (["pastor", "admin", "moderator"].includes(user.role)) {
      return <Navigate to="/admin/dashboard" replace />;
    }
    return <Navigate to="/portal/dashboard" replace />;
  }

  return <Home />;
};

export default SmartHome;