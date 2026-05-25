export const config = {
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? "0.0.0.0",
  nodeEnv: process.env.NODE_ENV ?? "development",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  cacheTtlSeconds: Number(process.env.CACHE_TTL_SECONDS ?? 60),
  useInMemory:
    process.env.USE_IN_MEMORY === "true" ||
    process.env.NODE_ENV === "test" ||
    process.env.USE_IN_MEMORY === "1",
};
