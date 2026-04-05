import axiosInstance from "../utils/axiosInstance";

export const getRosterBuilderData = async (params = {}) => {
  const response = await axiosInstance.get("/roster/builder", { params });
  return response.data;
};

export const createOrUpdateRoster = async (data) => {
  const response = await axiosInstance.post("/roster", data);
  return response.data;
};

export const publishRoster = async (rosterId) => {
  const response = await axiosInstance.put(`/roster/${rosterId}/publish`);
  return response.data;
};

export const getRosters = async (params = {}) => {
  const response = await axiosInstance.get("/roster", { params });
  return response.data;
};

export const getRosterById = async (rosterId) => {
  const response = await axiosInstance.get(`/roster/${rosterId}`);
  return response.data;
};

export const getWhatsAppText = async (rosterId) => {
  const response = await axiosInstance.get(`/roster/${rosterId}/whatsapp`);
  return response.data;
};