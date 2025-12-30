import type { Request, Response, NextFunction } from "express";
import { getFromCache, setInCache } from "../lib/cache.ts";

interface CacheOptions {
  ttl: number;
  keyGenerator?: (req: Request) => string;
}

// Response caching middleware
export const cacheResponse = (options: CacheOptions) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== "GET") {
      return next();
    }

    const key = options.keyGenerator
      ? options.keyGenerator(req)
      : `response:${req.originalUrl}`;

    try {
      // Check cache
      const cached = await getFromCache<{
        body: any;
        contentType: string;
      }>(key);

      if (cached) {
        res.setHeader("X-Cache", "HIT");
        res.setHeader("Content-Type", cached.contentType || "application/json");
        return res.json(cached.body);
      }

      // Store original json method
      const originalJson = res.json.bind(res);

      // Override json method to cache response
      res.json = (body: any) => {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          setInCache(
            key,
            {
              body,
              contentType: res.getHeader("Content-Type") || "application/json",
            },
            options.ttl
          );
        }
        res.setHeader("X-Cache", "MISS");
        return originalJson(body);
      };

      next();
    } catch (error) {
      // On cache error, just proceed without caching
      console.error("Cache middleware error:", error);
      next();
    }
  };
};

// Cache invalidation middleware for mutations
export const invalidateCachePatterns = (patterns: string[]) => {
  return async (_req: Request, res: Response, next: NextFunction) => {
    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to invalidate cache after successful response
    res.json = (body: any) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Invalidate cache patterns asynchronously
        Promise.all(
          patterns.map(async (pattern) => {
            const { deleteByPattern } = await import("../lib/cache.ts");
            return deleteByPattern(pattern);
          })
        ).catch(console.error);
      }
      return originalJson(body);
    };

    next();
  };
};

