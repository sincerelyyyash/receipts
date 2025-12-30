import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Main Redis client for caching
export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    if (times > 3) {
      console.error("Redis connection failed after 3 retries");
      return null;
    }
    return Math.min(times * 200, 2000);
  },
  lazyConnect: true,
});

// BullMQ requires maxRetriesPerRequest to be null
export const bullmqConnection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
});

redis.on("connect", () => {
  console.log("✅ Redis connected");
});

redis.on("error", (error) => {
  console.error("❌ Redis error:", error.message);
});

bullmqConnection.on("error", (error) => {
  console.error("❌ BullMQ Redis error:", error.message);
});

export const connectRedis = async () => {
  try {
    // Check if already connected or connecting
    if (redis.status === "ready" || redis.status === "connect") {
      console.log("✅ Redis already connected");
      return;
    }

    // Connect main Redis client (only if not already connected/connecting)
    await redis.connect();
    
    // Also connect bullmqConnection if not connected
    if (bullmqConnection.status !== "ready" && bullmqConnection.status !== "connect") {
      await bullmqConnection.connect();
    }
  } catch (error: any) {
    // Ignore "already connecting/connected" errors
    if (error?.message?.includes("already connecting") || error?.message?.includes("already connected")) {
      console.log("✅ Redis connection already established");
      return;
    }
    console.error("Failed to connect to Redis:", error);
    throw error;
  }
};

export const disconnectRedis = async () => {
  try {
    if (redis.status === "ready" || redis.status === "connect") {
      await redis.quit();
    }
  } catch (error) {
    console.error("Redis disconnect error:", error);
  }

  try {
    if (bullmqConnection.status === "ready" || bullmqConnection.status === "connect") {
      await bullmqConnection.quit();
    }
  } catch (error) {
    console.error("BullMQ Redis disconnect error:", error);
  }
};

