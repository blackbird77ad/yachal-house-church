import axiosInstance from "../utils/axiosInstance";

export const saveDraft = async (data) => {
  const response = await axiosInstance.post("/reports/draft", data, {
    timeout: 45000,
  });
  return response.data;
};

export const submitReport = async (data) => {
  const response = await axiosInstance.post("/reports/submit", data, {
    timeout: 60000,
  });
  return response.data;
};

export const editReport = async (reportId, data) => {
  const response = await axiosInstance.put(`/reports/edit/${reportId}`, data, {
    timeout: 60000,
  });
  return response.data;
};

export const getMyReports = async (params = {}) => {
  const response = await axiosInstance.get("/reports/my-reports", { params });
  return response.data;
};

export const getMyReportSummary = async () => {
  const response = await axiosInstance.get("/reports/my-report-summary");
  return response.data;
};

export const getMyDraft = async (params = {}) => {
  // Always include weekReference so backend finds the right week's draft
  const response = await axiosInstance.get("/reports/my-draft", {
    params,
    timeout: 30000,
  });
  return response.data;
};

export const getAllReports = async (params = {}) => {
  const response = await axiosInstance.get("/reports", { params });
  return response.data;
};

export const getReportById = async (reportId) => {
  const response = await axiosInstance.get(`/reports/${reportId}`);
  return response.data;
};

export const getReportPdfData = async (reportId) => {
  const response = await axiosInstance.get(`/reports/${reportId}/pdf-data`);
  return response.data;
};

export const deleteMyDraftReport = async (reportId) => {
  const response = await axiosInstance.delete(`/reports/my-drafts/${reportId}`);
  return response.data;
};
