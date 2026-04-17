import axiosInstance from "../utils/axiosInstance";

export const getDashboardSummary = async () => {
  const response = await axiosInstance.get("/admin/dashboard", {
    params: { _ts: Date.now() },
  });
  return response.data;
};

export const getPendingWorkers = async () => {
  const response = await axiosInstance.get("/admin/pending-workers");
  return response.data;
};

export const overridePortal = async (data) => {
  const response = await axiosInstance.post("/admin/portal-override", data);
  return response.data;
};

export const getLeaderboard = async (params = {}) => {
  const response = await axiosInstance.get("/admin/leaderboard", { params });
  return response.data;
};

export const createSpecialService = async (data) => {
  const response = await axiosInstance.post("/admin/special-service", data);
  return response.data;
};

export const sendBulkNotification = async (data) => {
  const response = await axiosInstance.post("/admin/notify", data);
  return response.data;
};

export const cleanupPortals = async () => {
  const response = await axiosInstance.post("/admin/portal-cleanup");
  return response.data;
};
