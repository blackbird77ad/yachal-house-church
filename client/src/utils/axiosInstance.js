import axios from "axios";

const LIVE_API_BASE_URL = "https://yachal-house-church.onrender.com/api";

const readEnvValue = (value) => {
  const normalized = String(value || "").trim();
  return normalized || "";
};

const readBooleanEnv = (value) => {
  const normalized = readEnvValue(value).toLowerCase();

  if (normalized === "true") return true;
  if (normalized === "false") return false;

  return null;
};

const isPrivateIpv4Hostname = (hostname = "") => {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;

  const [first, second] = match.slice(1, 3).map(Number);

  if (first === 10) return true;
  if (first === 127) return true;
  if (first === 192 && second === 168) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;

  return false;
};

const isLocalHostname = (hostname = "") => {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) return false;

  if (normalized === "localhost" || normalized === "::1") {
    return true;
  }

  if (normalized.endsWith(".local")) {
    return true;
  }

  if (isPrivateIpv4Hostname(normalized)) {
    return true;
  }

  // Hostnames without dots are typically machine names on a local network.
  if (!normalized.includes(".")) {
    return true;
  }

  return false;
};

const getLocalApiBaseUrl = () => {
  const configuredLocalApiUrl = readEnvValue(import.meta.env.VITE_LOCAL_API_URL);

  if (configuredLocalApiUrl) {
    return configuredLocalApiUrl;
  }

  if (typeof window !== "undefined") {
    const { hostname } = window.location;
    const localPort = readEnvValue(import.meta.env.VITE_LOCAL_API_PORT) || "5000";

    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
      return `http://localhost:${localPort}/api`;
    }

    return `http://${hostname}:${localPort}/api`;
  }

  return "http://localhost:5000/api";
};

const shouldUseLocalApiFallback = () => {
  if (typeof window === "undefined") {
    return false;
  }

  const localFallbackOverride = readBooleanEnv(import.meta.env.VITE_ALLOW_LOCAL_API_FALLBACK);

  if (localFallbackOverride === false) {
    return false;
  }

  if (localFallbackOverride === true) {
    return isLocalHostname(window.location.hostname);
  }

  return import.meta.env.DEV && isLocalHostname(window.location.hostname);
};

const resolveApiBaseUrl = () => {
  const configuredApiBaseUrl = readEnvValue(import.meta.env.VITE_API_URL);

  if (import.meta.env.PROD) {
    return configuredApiBaseUrl || LIVE_API_BASE_URL;
  }

  if (shouldUseLocalApiFallback()) {
    return getLocalApiBaseUrl();
  }

  return configuredApiBaseUrl || LIVE_API_BASE_URL;
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
