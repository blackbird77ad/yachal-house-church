import axios from "axios";

const resolveApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  if (typeof window !== "undefined") {
    const { hostname } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:5000/api";
    }
  }

  return "https://yachal-house-church.onrender.com/api";
};

const axiosInstance = axios.create({
  baseURL: resolveApiBaseUrl(),
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// Request: attach JWT token
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("yahal_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response: handle auth only
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config || {};
    const requestUrl = String(config.url || "");
    const isAuthPageRequest =
      requestUrl.includes("/auth/login") ||
      requestUrl.includes("/auth/register") ||
      requestUrl.includes("/auth/forgot-password");

    // 401: token expired/invalid -> logout once
    if (error.response?.status === 401 && !isAuthPageRequest) {
      localStorage.removeItem("yahal_token");
      localStorage.removeItem("yahal_user");

      if (!window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }

      return Promise.reject(error);
    }

    // DO NOT auto-retry 429 globally
    // DO NOT auto-retry network errors globally
    // Let each page decide whether it wants a retry.
    return Promise.reject(error);
  }
);

export default axiosInstance;
