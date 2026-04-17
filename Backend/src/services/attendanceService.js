import axiosInstance from "../utils/axiosInstance";

/**
 * Get current active attendance session
 */
export const getActiveAttendance = async () => {
  const res = await axiosInstance.get("/attendance/active");
  return res.data;
};

/**
 * Get attendance history
 */
export const getAttendanceHistory = async (params = {}) => {
  const res = await axiosInstance.get("/attendance/history", { params });
  return res.data;
};

/**
 * ✅ FIX: Get MY attendance for current week (USED IN FORMS)
 */
export const getMyWeekAttendance = async () => {
  const res = await axiosInstance.get("/attendance/my-week");
  return res.data;
};

/**
 * Mark attendance (if you have this already)
 */
export const markAttendance = async (data) => {
  const res = await axiosInstance.post("/attendance/mark", data);
  return res.data;
};