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
    await redis.connect();
  } catch (error) {
    console.error("Failed to connect to Redis:", error);
  }
};

export const disconnectRedis = async () => {
  await redis.quit();
  await bullmqConnection.quit();
};

