import axiosInstance from "../utils/axiosInstance";

export const getAllWorkers = async (params = {}) => {
  const response = await axiosInstance.get("/workers", { params });
  return response.data;
};

export const getWorkerById = async (workerId) => {
  const response = await axiosInstance.get(`/workers/${workerId}`);
  return response.data;
};

export const getWorkerByWorkerId = async (workerId) => {
  const response = await axiosInstance.get(`/workers/by-worker-id/${workerId}`);
  return response.data;
};

export const searchWorkers = async (name) => {
  const response = await axiosInstance.get("/workers/search", { params: { name } });
  return response.data;
};

export const updateWorker = async (workerId, data) => {
  const response = await axiosInstance.put(`/workers/${workerId}`, data);
  return response.data;
};

export const getWorkerMetrics = async (workerId, params = {}) => {
  const response = await axiosInstance.get(`/workers/${workerId}/metrics`, { params });
  return response.data;
};

export const getMyProfile = async () => {
  const response = await axiosInstance.get("/workers/me");
  return response.data;
};

export const updateMyProfile = async (data) => {
  const response = await axiosInstance.put("/workers/me", data);
  return response.data;
};