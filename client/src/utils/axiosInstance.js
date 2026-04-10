import axios from "axios";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "https://yachal-house-church.onrender.com/api",
  withCredentials: true,
});

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("yahal_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("yahal_token");
      localStorage.removeItem("yahal_user");
      window.location.href = "/login";
      return Promise.reject(error);
    }

    // Retry once on connection closed (Render cold start)
    const config = error.config;
    if (!config || config._retry) return Promise.reject(error);

    const isConnectionError = !error.response &&
      (error.code === "ERR_CONNECTION_CLOSED" ||
       error.code === "ERR_NETWORK" ||
       error.message === "Network Error");

    if (isConnectionError) {
      config._retry = true;
      await new Promise((r) => setTimeout(r, 3000)); // wait 3s then retry
      return axiosInstance(config);
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;