import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectRedis, redis } from "./config/redis.ts";
import { prisma } from "./lib/prisma.ts";
import { errorHandler } from "./middleware/errorHandler.ts";
import routes from "./routes/index.ts";
import { createPipelineWorker } from "./services/pipeline.service.ts";

let pipelineWorker: ReturnType<typeof createPipelineWorker> | null = null;

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());

// API routes
app.use("/api", routes);

// Global error handler
app.use(errorHandler);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
  });
});

// Graceful shutdown
const shutdown = async () => {
  console.log("\n🛑 Shutting down gracefully...");

  try {
    if (pipelineWorker) {
      await pipelineWorker.close();
      console.log("✅ Pipeline worker stopped");
    }
  } catch (error) {
    console.error("Pipeline worker stop error:", error);
  }

  try {
    await redis.quit();
    console.log("✅ Redis disconnected");
  } catch (error) {
    console.error("Redis disconnect error:", error);
  }

  try {
    await prisma.$disconnect();
    console.log("✅ Database disconnected");
  } catch (error) {
    console.error("Database disconnect error:", error);
  }

  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Start server
const startServer = async () => {
  try {
    // Connect to Redis
    await connectRedis();

    // Test database connection
    await prisma.$connect();
    console.log("✅ Database connected");

    // Start pipeline worker
    pipelineWorker = createPipelineWorker();

    app.listen(PORT, () => {
      console.log(`
🚀 Server running on http://localhost:${PORT}
📊 API endpoints:
   - GET  /api/health              - Health check
   - GET  /api/channels            - List all YouTubers
   - POST /api/channels            - Add new channel
   - GET  /api/channels/:id        - Get channel details
   - POST /api/channels/:id/sync   - Sync videos for time range
   - GET  /api/videos              - List videos
   - GET  /api/videos/:id          - Get video with predictions
   - POST /api/videos/:id/transcript - Fetch transcript
   - POST /api/videos/:id/analyze  - Analyze video
   - GET  /api/leaderboard         - Get accuracy leaderboard
   - GET  /api/leaderboard/stats   - Get platform statistics
      `);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

