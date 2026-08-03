import rateLimit from "express-rate-limit";
import {
  rateLimitCredentialOrIpKey,
  rateLimitIpKey,
  rateLimitUserOrIpKey,
} from "../utils/rateLimitIdentity.js";

const AUTH_RATE_LIMITED_PATHS = new Set([
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/forgot-password",
]);

const shouldSkipGlobalLimiter = (req) => {
  const path = req.originalUrl.split("?")[0];
  return AUTH_RATE_LIMITED_PATHS.has(path);
};

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: "Too many login attempts. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitIpKey,
  skipSuccessfulRequests: true,
});

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1200,
  message: { message: "Too many requests. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitCredentialOrIpKey,
  skip: shouldSkipGlobalLimiter,
});

export const reportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 90,
  message: { message: "Too many report requests. Please wait a moment." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitUserOrIpKey,
});

export const generalLimiter = apiLimiter;
