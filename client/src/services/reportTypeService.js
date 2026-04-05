import axiosInstance from "../utils/axiosInstance";

export const getAllReportTypes = async (params = {}) => {
  const response = await axiosInstance.get("/report-types", { params });
  return response.data;
};

export const getReportTypeById = async (reportTypeId) => {
  const response = await axiosInstance.get(`/report-types/${reportTypeId}`);
  return response.data;
};

export const createReportType = async (data) => {
  const response = await axiosInstance.post("/report-types", data);
  return response.data;
};

export const updateReportType = async (reportTypeId, data) => {
  const response = await axiosInstance.put(`/report-types/${reportTypeId}`, data);
  return response.data;
};

export const deleteReportType = async (reportTypeId) => {
  const response = await axiosInstance.delete(`/report-types/${reportTypeId}`);
  return response.data;
};