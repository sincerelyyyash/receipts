import { redis } from "../config/redis.ts";
import { connectRedis } from "../config/redis.ts";

const clearCache = async () => {
  try {
    await connectRedis();
    console.log("✅ Connected to Redis");

    // Clear all response caches
    const patterns = [
      "response:/api/channels*",
      "response:channel:*",
      "response:/api/leaderboard*",
      "response:/api/videos*",
    ];

    for (const pattern of patterns) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
        console.log(`✅ Cleared ${keys.length} keys matching pattern: ${pattern}`);
      } else {
        console.log(`ℹ️  No keys found for pattern: ${pattern}`);
      }
    }

    // Also clear data caches
    const dataPatterns = [
      "channel:*",
      "video:*",
      "leaderboard",
    ];

    for (const pattern of dataPatterns) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
        console.log(`✅ Cleared ${keys.length} keys matching pattern: ${pattern}`);
      } else {
        console.log(`ℹ️  No keys found for pattern: ${pattern}`);
      }
    }

    console.log("\n✅ Cache cleared successfully!");
    await redis.quit();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error clearing cache:", error);
    process.exit(1);
  }
};

clearCache();

