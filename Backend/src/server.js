import app from "./app.js";
import connectDB from "./config/db.js";
import { env } from "./config/env.js";
import { initScheduler, syncPortalStateOnStartup } from "./services/schedulerService.js";

// ── Catch unhandled errors before they crash the process ──────────
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err.message);
  console.error(err.stack);
  // Give time to log then exit — process manager will restart
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION:", reason);
  // Don't exit — Render keeps running, just log it
});

// ── Start server ──────────────────────────────────────────────────
const startServer = async () => {
  try {
    await connectDB();

    const server = app.listen(env.port, async () => {
      console.log(`✅ Yachal House API running on port ${env.port}`);
      console.log(`🌍 Environment: ${env.nodeEnv || "production"}`);
      console.log(`🔗 Health: https://yachal-house-church.onrender.com/api/health`);

      initScheduler();
      await syncPortalStateOnStartup();
    });

    // ── Graceful shutdown ─────────────────────────────────────────
    const shutdown = (signal) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);
      server.close(() => {
        console.log("HTTP server closed.");
        process.exit(0);
      });
      // Force exit after 10s if connections don't close
      setTimeout(() => {
        console.error("Forcing exit after timeout.");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT",  () => shutdown("SIGINT"));

  } catch (err) {
    console.error("Failed to start server:", err.message);
    process.exit(1);
  }
};

startServer();