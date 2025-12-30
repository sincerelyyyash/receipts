import { redis } from "../config/redis.ts";

// Cache TTL configuration (in seconds)
export const CACHE_TTL = {
  CHANNEL: 60 * 60 * 24, // 24 hours
  VIDEO_LIST: 60 * 60 * 24, // 24 hours
  TRANSCRIPT: 60 * 60 * 24 * 7, // 7 days
  LEADERBOARD: 60 * 60, // 1 hour
  STATS: 60 * 60, // 1 hour
  VIDEO_META: 60 * 60 * 24 * 7, // 7 days
} as const;

// Cache key generators
export const cacheKeys = {
  channel: (channelId: string) => `channel:${channelId}`,
  channelVideos: (channelId: string, year: number) =>
    `channel:${channelId}:videos:${year}`,
  videoMeta: (videoId: string) => `video:${videoId}:meta`,
  transcript: (videoId: string) => `video:${videoId}:transcript`,
  leaderboard: () => "leaderboard",
  youtuberStats: (youtuberId: string) => `youtuber:${youtuberId}:stats`,
};

// Generic cache getter
export const getFromCache = async <T>(key: string): Promise<T | null> => {
  try {
    const cached = await redis.get(key);
    if (!cached) return null;
    return JSON.parse(cached) as T;
  } catch (error) {
    console.error(`Cache get error for key ${key}:`, error);
    return null;
  }
};

// Generic cache setter
export const setInCache = async <T>(
  key: string,
  data: T,
  ttl: number
): Promise<void> => {
  try {
    await redis.setex(key, ttl, JSON.stringify(data));
  } catch (error) {
    console.error(`Cache set error for key ${key}:`, error);
  }
};

// Delete from cache
export const deleteFromCache = async (key: string): Promise<void> => {
  try {
    await redis.del(key);
  } catch (error) {
    console.error(`Cache delete error for key ${key}:`, error);
  }
};

// Delete multiple keys by pattern
export const deleteByPattern = async (pattern: string): Promise<void> => {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.error(`Cache delete pattern error for ${pattern}:`, error);
  }
};

// Invalidate channel-related cache
export const invalidateChannelCache = async (
  channelId: string
): Promise<void> => {
  // Invalidate response cache (used by cacheResponse middleware)
  await deleteByPattern(`response:channel:${channelId}*`);
  await deleteByPattern(`response:/api/channels/${channelId}*`);
  // Invalidate data cache
  await deleteByPattern(`channel:${channelId}*`);
  // Invalidate list cache
  await deleteByPattern(`response:/api/channels`);
  await deleteFromCache(cacheKeys.leaderboard());
};

// Invalidate video-related cache
export const invalidateVideoCache = async (videoId: string): Promise<void> => {
  await deleteByPattern(`video:${videoId}*`);
};

// Cache-aside pattern helper
export const withCache = async <T>(
  key: string,
  ttl: number,
  fetchFn: () => Promise<T>
): Promise<T> => {
  // Try cache first
  const cached = await getFromCache<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch fresh data
  const data = await fetchFn();

  // Store in cache
  await setInCache(key, data, ttl);

  return data;
};

