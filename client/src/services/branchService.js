import axiosInstance from "../utils/axiosInstance";

export const getPublicBranches = async () => {
  const response = await axiosInstance.get("/branches/public");
  return response.data;
};

export const getBranches = async (params = {}) => {
  const response = await axiosInstance.get("/branches", { params });
  return response.data;
};

export const getBranchAdminCandidates = async () => {
  const response = await axiosInstance.get("/branches/admin-candidates");
  return response.data;
};

export const createBranch = async (data) => {
  const response = await axiosInstance.post("/branches", data);
  return response.data;
};

export const updateBranch = async (branchId, data) => {
  const response = await axiosInstance.put(`/branches/${branchId}`, data);
  return response.data;
};

export const suspendBranch = async (branchId) => {
  const response = await axiosInstance.put(`/branches/${branchId}/suspend`);
  return response.data;
};

export const reinstateBranch = async (branchId) => {
  const response = await axiosInstance.put(`/branches/${branchId}/reinstate`);
  return response.data;
};

export const deleteBranch = async (branchId) => {
  const response = await axiosInstance.delete(`/branches/${branchId}`);
  return response.data;
};
