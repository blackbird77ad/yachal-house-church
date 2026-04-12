import axiosInstance from "../utils/axiosInstance";

// ── Worker endpoints ──────────────────────────────────────────────────────────

// Get current worker's check-ins for the current week (or a specific week)
// Used by EvangelismForm to pre-fill service attendance times from front desk records
export const getMyWeekAttendance = async (params = {}) => {
  const response = await axiosInstance.get("/attendance/my-week", { params });
  return response.data;
};

// ── Front desk / admin endpoints ──────────────────────────────────────────────

// Get the currently active session
export const getActiveSession = async () => {
  const response = await axiosInstance.get("/attendance/active");
  return response.data;
};

// Create a new front desk session
export const createSession = async (data) => {
  const response = await axiosInstance.post("/attendance/session", data);
  return response.data;
};

// Check in a worker to the current session
export const checkInWorker = async (data) => {
  const response = await axiosInstance.post("/attendance/check-in", data);
  return response.data;
};

// Get all check-ins for a specific session
export const getSessionAttendance = async (sessionId) => {
  const response = await axiosInstance.get(`/attendance/session/${sessionId}`);
  return response.data;
};

// Close a front desk session
export const closeSession = async (sessionId, data = {}) => {
  const response = await axiosInstance.put(`/attendance/close/${sessionId}`, data);
  return response.data;
};

// Get session report
export const getSessionReport = async (sessionId) => {
  const response = await axiosInstance.get(`/attendance/report/${sessionId}`);
  return response.data;
};

// Search for a worker at front desk check-in
export const searchWorkerForCheckIn = async (query) => {
  const response = await axiosInstance.get(`/attendance/search?q=${encodeURIComponent(query)}`);
  return response.data;
};

// Get attendance history (admin only)
export const getAttendanceHistory = async (params = {}) => {
  const response = await axiosInstance.get("/attendance/history", { params });
  return response.data;
};