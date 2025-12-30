import { Router } from "express";
import channelsRouter from "./channels.routes.ts";
import videosRouter from "./videos.routes.ts";
import leaderboardRouter from "./leaderboard.routes.ts";

const router = Router();

// Health check
router.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "API is running",
    timestamp: new Date().toISOString(),
  });
});

// Mount routes
router.use("/channels", channelsRouter);
router.use("/videos", videosRouter);
router.use("/leaderboard", leaderboardRouter);

export default router;

