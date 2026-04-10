import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";

import authRoute from "./routes/authRoute.js";
import reportRoute from "./routes/reportRoute.js";
import workerRoute from "./routes/workerRoute.js";
import adminRoute from "./routes/adminRoute.js";
import metricsRoute from "./routes/metricsRoute.js";
import notificationRoute from "./routes/notificationRoute.js";
import reportTypeRoute from "./routes/reportTypeRoute.js";
import portalRoute from "./routes/portalRoute.js";
import attendanceRoute from "./routes/attendanceRoute.js";
import rosterRoute from "./routes/rosterRoute.js";
import mediaRoute from "./routes/mediaRoute.js";
import serviceTimeRoute from "./routes/serviceTimeRoute.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

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
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) return callback(null, true);

    // In development allow localhost
    if (
      origin.startsWith("http://localhost") ||
      origin.startsWith("http://127.0.0.1")
    ) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

// Handle preflight requests for all routes
app.options("/{*any}", cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { message: "Too many requests, please try again later." },
});

app.use("/api", limiter);

app.use("/api/auth", authRoute);
app.use("/api/reports", reportRoute);
app.use("/api/workers", workerRoute);
app.use("/api/admin", adminRoute);
app.use("/api/metrics", metricsRoute);
app.use("/api/notifications", notificationRoute);
app.use("/api/report-types", reportTypeRoute);
app.use("/api/portal", portalRoute);
app.use("/api/attendance", attendanceRoute);
app.use("/api/roster", rosterRoute);
app.use("/api/media", mediaRoute);
app.use("/api/service-times", serviceTimeRoute);

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "Yachal House API is running.",
    timestamp: new Date(),
  });
});

app.use(errorHandler);

export default app;