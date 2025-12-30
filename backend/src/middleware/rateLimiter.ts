import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { redis } from "../config/redis.ts";
import type { Request, Response, NextFunction } from "express";

// Helper to create Redis send command
const createSendCommand = () => {
  return async (...args: string[]): Promise<number> => {
    // @ts-expect-error - Redis call method expects specific types
    return redis.call(...args);
  };
};

// Standard API rate limit - 100 requests per 15 minutes
export const apiLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: createSendCommand(),
    prefix: "rl:api:",
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    success: false,
    error: "Too many requests, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return req.ip || req.headers["x-forwarded-for"]?.toString() || "unknown";
  },
});

// Heavy operations rate limit - 10 per hour (sync, analyze)
export const heavyLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: createSendCommand(),
    prefix: "rl:heavy:",
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: {
    success: false,
    error: "Rate limit for expensive operations exceeded. Try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return req.ip || req.headers["x-forwarded-for"]?.toString() || "unknown";
  },
});

// YouTube API rate limit - 500 calls per day (conservative to stay under 10k units)
export const youtubeApiLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: createSendCommand(),
    prefix: "rl:youtube:",
  }),
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 500,
  message: {
    success: false,
    error: "YouTube API daily quota limit reached. Try again tomorrow.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: () => "global", // Global limit for YouTube API
});

// Skip rate limiting in development if needed
export const conditionalRateLimiter = (
  limiter: ReturnType<typeof rateLimit>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV === "development" && process.env.SKIP_RATE_LIMIT === "true") {
      return next();
    }
    return limiter(req, res, next);
  };
};

