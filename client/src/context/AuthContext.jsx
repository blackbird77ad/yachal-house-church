import { createContext, useContext, useState, useEffect, useCallback } from "react";
import axiosInstance from "../utils/axiosInstance";
import { ADMIN_ROLES } from "../utils/constants";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem("yahal_token");
    const storedUser = localStorage.getItem("yahal_user");
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = useCallback((userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem("yahal_token", authToken);
    localStorage.setItem("yahal_user", JSON.stringify(userData));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("yahal_token");
    localStorage.removeItem("yahal_user");
  }, []);

  const updateUser = useCallback((updatedData) => {
    const updated = { ...user, ...updatedData };
    setUser(updated);
    localStorage.setItem("yahal_user", JSON.stringify(updated));
  }, [user]);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await axiosInstance.get("/auth/me");
      updateUser(data.user);
    } catch {
      logout();
    }
  }, [updateUser, logout]);

  const isAdminLevel = user && ADMIN_ROLES.includes(user.role);
  const isPastor = user?.role === "pastor";
  const isAdmin = user?.role === "admin";
  const isModerator = user?.role === "moderator";
  const isWorker = user?.role === "worker";
  const isApproved = user?.status === "approved";

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        updateUser,
        refreshUser,
        isAdminLevel,
        isPastor,
        isAdmin,
        isModerator,
        isWorker,
        isApproved,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

export default AuthContext;