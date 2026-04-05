import axiosInstance from "../utils/axiosInstance";

export const getPortalStatus = async () => {
  const response = await axiosInstance.get("/portal/status");
  return response.data;
};

export const getPortalHistory = async () => {
  const response = await axiosInstance.get("/portal/history");
  return response.data;
};