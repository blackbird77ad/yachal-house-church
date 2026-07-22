import { useAuth } from "./useAuth";
import { clearTourStorageForRole } from "../utils/tourStorage";

export const useRestartTour = () => {
  const { user } = useAuth();

  return () => {
    if (!user) return;

    clearTourStorageForRole(user.role);
    window.location.reload();
  };
};

export default useRestartTour;
