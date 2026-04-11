import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";

import authRoute         from "./routes/authRoute.js";
import reportRoute       from "./routes/reportRoute.js";
import workerRoute       from "./routes/workerRoute.js";
import adminRoute        from "./routes/adminRoute.js";
import metricsRoute      from "./routes/metricsRoute.js";
import notificationRoute from "./routes/notificationRoute.js";
import reportTypeRoute   from "./routes/reportTypeRoute.js";
import portalRoute       from "./routes/portalRoute.js";
import attendanceRoute   from "./routes/attendanceRoute.js";
import rosterRoute       from "./routes/rosterRoute.js";
import mediaRoute        from "./routes/mediaRoute.js";
import serviceTimeRoute  from "./routes/serviceTimeRoute.js";
import pushRoute         from "./routes/pushRoute.js";
import { errorHandler }  from "./middleware/errorHandler.js";

const app = express();

// ── Security headers ─────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false, // CSP handled by Cloudflare
}));

// ── Compression ──────────────────────────────────────────────────
app.use(compression());

// ── CORS ─────────────────────────────────────────────────────────
const allowedOrigins = [
  "https://yachalhousegh.org",
  "https://www.yachalhousegh.org",
  "https://yachalhousegh.com",
  "https://www.yachalhousegh.com",
  "https://yachal-house-church.pages.dev",
  ...(env.clientUrl ? [env.clientUrl] : []),
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1")) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options("/{*any}", cors(corsOptions));

// Trust Render/Cloudflare proxy for correct IP in rate limiting
app.set("trust proxy", 1);

// ── Body parsing — limit size to prevent payload attacks ─────────
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// ── Rate limiting ─────────────────────────────────────────────────
// General: 300 req / 15 min per IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please slow down." },
});

// Auth: 20 attempts / 15 min per IP — brute force protection
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts. Please try again in 15 minutes." },
});

app.use("/api", generalLimiter);
app.use("/api/auth/login",    authLimiter);
app.use("/api/auth/register", authLimiter);

// ── Routes ────────────────────────────────────────────────────────
app.use("/api/auth",          authRoute);
app.use("/api/reports",       reportRoute);
app.use("/api/workers",       workerRoute);
app.use("/api/admin",         adminRoute);
app.use("/api/metrics",       metricsRoute);
app.use("/api/notifications", notificationRoute);
app.use("/api/report-types",  reportTypeRoute);
app.use("/api/portal",        portalRoute);
app.use("/api/attendance",    attendanceRoute);
app.use("/api/roster",        rosterRoute);
app.use("/api/media",         mediaRoute);
app.use("/api/service-times", serviceTimeRoute);
app.use("/api/push",          pushRoute);

// ── Health check ──────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "Yachal House API is running.",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()) + "s",
  });
});

// ── 404 catch-all ─────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: "Route not found." });
});

// ── Global error handler ──────────────────────────────────────────
app.use(errorHandler);

export default app;