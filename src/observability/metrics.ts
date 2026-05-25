import {
  Counter,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from "prom-client";

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const cacheHitTotal = new Counter({
  name: "cache_hit_total",
  help: "Product catalog cache hits",
  registers: [registry],
});

export const cacheMissTotal = new Counter({
  name: "cache_miss_total",
  help: "Product catalog cache misses",
  registers: [registry],
});

export const checkoutStartedTotal = new Counter({
  name: "checkout_started_total",
  help: "Checkouts accepted (202)",
  registers: [registry],
});

export const checkoutCompletedTotal = new Counter({
  name: "checkout_completed_total",
  help: "Orders completed by worker",
  registers: [registry],
});

export const checkoutFailedTotal = new Counter({
  name: "checkout_failed_total",
  help: "Orders failed during processing",
  registers: [registry],
});

export const workerJobsTotal = new Counter({
  name: "worker_jobs_total",
  help: "Checkout worker jobs processed",
  labelNames: ["result"] as const,
  registers: [registry],
});

export const workerDurationMs = new Histogram({
  name: "worker_duration_ms",
  help: "Checkout worker job duration in milliseconds",
  buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000],
  registers: [registry],
});

export const httpRequestDurationMs = new Histogram({
  name: "http_request_duration_ms",
  help: "HTTP request duration in milliseconds",
  labelNames: ["method", "route", "status_code"] as const,
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500],
  registers: [registry],
});
