import { describe, it, expect } from "vitest";
import { cacheHitTotal, cacheMissTotal } from "../src/observability/metrics.js";
import { inject } from "./helpers/test-app.js";

describe("GET /products", () => {
  it("returns catalog", async () => {
    const res = await inject("GET", "/products");
    expect(res.statusCode).toBe(200);
    const body = res.json() as { products: unknown[] };
    expect(body.products.length).toBeGreaterThan(0);
  });

  it("uses cache: miss then hit", async () => {
    const missBefore = (await cacheMissTotal.get()).values[0]?.value ?? 0;
    const hitBefore = (await cacheHitTotal.get()).values[0]?.value ?? 0;

    const first = await inject("GET", "/products");
    expect(first.statusCode).toBe(200);

    const second = await inject("GET", "/products");
    expect(second.statusCode).toBe(200);

    const missAfter = (await cacheMissTotal.get()).values[0]?.value ?? 0;
    const hitAfter = (await cacheHitTotal.get()).values[0]?.value ?? 0;

    expect(missAfter - missBefore).toBe(1);
    expect(hitAfter - hitBefore).toBe(1);
  });

  it("propagates correlation headers", async () => {
    const res = await inject("GET", "/products", {
      headers: {
        "x-correlation-id": "corr-test-1",
        "x-request-id": "req-test-1",
      },
    });
    expect(res.headers["x-request-id"]).toBe("req-test-1");
    expect(res.headers["x-correlation-id"]).toBe("corr-test-1");
  });
});
