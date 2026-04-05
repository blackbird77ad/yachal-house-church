import app from "./app.js";
import connectDB from "./config/db.js";
import { env } from "./config/env.js";
import { initScheduler, syncPortalStateOnStartup } from "./services/schedulerService.js";

const startServer = async () => {
  await connectDB();

  app.listen(env.port, async () => {
    console.log(`✅ Yahal House API running on port ${env.port}`);
    console.log(`🌍 Environment: ${env.nodeEnv}`);
    console.log(`🔗 Health check: http://localhost:${env.port}/api/health\n`);

    initScheduler();
    await syncPortalStateOnStartup();
  });
};

startServer();