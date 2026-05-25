import { beforeEach, afterEach } from "vitest";
import { buildApp, closeApp, type AppContext } from "../../src/app.js";
import { registry } from "../../src/observability/metrics.js";

let ctx: AppContext;

export async function createTestApp(): Promise<AppContext> {
  process.env.NODE_ENV = "test";
  process.env.USE_IN_MEMORY = "true";
  ctx = await buildApp();
  return ctx;
}

export function getTestContext(): AppContext {
  return ctx;
}

export async function inject(
  method: "GET" | "POST",
  url: string,
  opts?: {
    payload?: unknown;
    headers?: Record<string, string>;
  },
) {
  return ctx.app.inject({
    method,
    url,
    payload: opts?.payload,
    headers: opts?.headers,
  });
}

export async function waitForOrderStatus(
  orderId: string,
  expected: string,
  timeoutMs = 5000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await inject("GET", `/orders/${orderId}/status`);
    if (res.statusCode === 200) {
      const body = res.json() as { status: string };
      if (body.status === expected) return;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`Order ${orderId} did not reach status ${expected}`);
}

beforeEach(async () => {
  registry.resetMetrics();
  if (ctx) {
    await closeApp(ctx);
  }
  ctx = await createTestApp();
  ctx.productRepository.reset();
  ctx.orderRepository.clear();
});

afterEach(async () => {
  if (ctx) await closeApp(ctx);
});
