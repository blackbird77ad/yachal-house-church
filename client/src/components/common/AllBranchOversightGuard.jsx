import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { canManageAllBranches } from "../../utils/branchAccess";

const AllBranchOversightGuard = ({ children }) => {
  const { user } = useAuth();

  if (!canManageAllBranches(user)) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return children;
};

export default AllBranchOversightGuard;
