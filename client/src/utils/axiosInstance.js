import axios from "axios";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "https://yachal-house-church.onrender.com/api",
  timeout: 30000, // 30s — covers Render cold start
  headers: { "Content-Type": "application/json" },
});

// ── Request — attach JWT token ────────────────────────────────────
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("yahal_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response — handle auth, retries, connection errors ───────────
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;

    // 401 — token expired or invalid, force logout
    if (error.response?.status === 401) {
      localStorage.removeItem("yahal_token");
      localStorage.removeItem("yahal_user");
      // Only redirect if not already on login page
      if (!window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
      return Promise.reject(error);
    }

    // 429 — rate limited, wait and retry once
    if (error.response?.status === 429 && !config._retry429) {
      config._retry429 = true;
      const retryAfter = parseInt(error.response.headers["retry-after"] || "15") * 1000;
      await new Promise((r) => setTimeout(r, Math.min(retryAfter, 15000)));
      return axiosInstance(config);
    }

    // Network / connection error — retry once after 3s (Render cold start)
    if (!config._retryNetwork) {
      const isNetworkError = !error.response && (
        error.code === "ERR_NETWORK" ||
        error.code === "ERR_CONNECTION_CLOSED" ||
        error.code === "ECONNABORTED" ||
        error.message === "Network Error"
      );
      if (isNetworkError) {
        config._retryNetwork = true;
        await new Promise((r) => setTimeout(r, 3000));
        return axiosInstance(config);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;