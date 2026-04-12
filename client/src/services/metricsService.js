import axiosInstance from "../utils/axiosInstance";

export const getMyMetrics = async (params = {}) => {
  const response = await axiosInstance.get("/metrics/me", { params });
  return response.data;
};

export const getMyMetricsHistory = async () => {
  const response = await axiosInstance.get("/metrics/me/history");
  return response.data;
};

export const getAllMetrics = async (params = {}) => {
  const response = await axiosInstance.get("/metrics", { params });
  return response.data;
};

export const getQualifiedWorkers = async (params = {}) => {
  const response = await axiosInstance.get("/metrics/qualified", { params });
  return response.data;
};

export const getDisqualifiedWorkers = async (params = {}) => {
  const response = await axiosInstance.get("/metrics/disqualified", { params });
  return response.data;
};

export const getLateMetrics = async (params = {}) => {
  const response = await axiosInstance.get("/metrics/late", { params });
  return response.data;
};

export const triggerManualProcessing = async (data) => {
  const response = await axiosInstance.post("/metrics/process", data);
  return response.data;
};

export const getAllWorkersStatus = async (params = {}) => {
  const response = await axiosInstance.get("/metrics/all-status", { params });
  return response.data;
};