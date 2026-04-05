import axiosInstance from "../utils/axiosInstance";

export const loginUser = async (data) => {
  const response = await axiosInstance.post("/auth/login", data);
  return response.data;
};

export const registerUser = async (data) => {
  const response = await axiosInstance.post("/auth/register", data);
  return response.data;
};

export const getMe = async () => {
  const response = await axiosInstance.get("/auth/me");
  return response.data;
};

export const approveWorker = async (workerId) => {
  const response = await axiosInstance.put(`/auth/approve/${workerId}`);
  return response.data;
};

export const suspendWorker = async (workerId) => {
  const response = await axiosInstance.put(`/auth/suspend/${workerId}`);
  return response.data;
};

export const reinstateWorker = async (workerId) => {
  const response = await axiosInstance.put(`/auth/reinstate/${workerId}`);
  return response.data;
};

export const generateIdForWorker = async (workerId) => {
  const response = await axiosInstance.put(`/auth/generate-id/${workerId}`);
  return response.data;
};

export const getWorkersWithoutId = async () => {
  const response = await axiosInstance.get("/auth/no-id");
  return response.data;
};

export const changePassword = async (data) => {
  const response = await axiosInstance.put("/auth/change-password", data);
  return response.data;
};

export const adminCreateWorker = async (data) => {
  const response = await axiosInstance.post("/auth/create-worker", data);
  return response.data;
};

export const adminBulkCreateWorkers = async (data) => {
  const response = await axiosInstance.post("/auth/bulk-create-workers", data);
  return response.data;
};