import { describe, it, expect } from "vitest";
import { apiInject, waitForOrderStatus } from "./helpers/test-app.js";

describe("POST /checkout", () => {
  it("returns 202 with orderId and processing status", async () => {
    const res = await apiInject("POST", "/checkout", {
      payload: { items: [{ productId: "p1", quantity: 1 }] },
    });
    expect(res.statusCode).toBe(202);
    const body = res.json() as { orderId: string; status: string };
    expect(body.orderId).toMatch(/^ord_/);
    expect(body.status).toBe("processing");
  });

  it("rejects empty items", async () => {
    const res = await apiInject("POST", "/checkout", {
      payload: { items: [] },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json() as { error: string };
    expect(body.error).toBe("INVALID_CHECKOUT");
  });

  it("returns 409 when out of stock", async () => {
    const res = await apiInject("POST", "/checkout", {
      payload: { items: [{ productId: "p2", quantity: 999 }] },
    });
    expect(res.statusCode).toBe(409);
    const body = res.json() as { error: string };
    expect(body.error).toBe("OUT_OF_STOCK");
  });
});

describe("GET /orders/:orderId/status", () => {
  it("tracks order until completed", async () => {
    const checkout = await apiInject("POST", "/checkout", {
      payload: { items: [{ productId: "p3", quantity: 1 }] },
    });
    const { orderId } = checkout.json() as { orderId: string };

    await waitForOrderStatus(orderId, "completed");

    const status = await apiInject("GET", `/orders/${orderId}/status`);
    expect(status.statusCode).toBe(200);
    expect(status.json()).toMatchObject({
      orderId,
      status: "completed",
    });
  });

  it("returns 404 for unknown order", async () => {
    const res = await apiInject("GET", "/orders/ord_unknown/status");
    expect(res.statusCode).toBe(404);
  });
});

describe("Idempotency-Key", () => {
  it("returns same order on retry", async () => {
    const key = "idem-test-key-1";
    const payload = { items: [{ productId: "p3", quantity: 1 }] };

    const first = await apiInject("POST", "/checkout", {
      payload,
      headers: { "idempotency-key": key },
    });
    const second = await apiInject("POST", "/checkout", {
      payload,
      headers: { "idempotency-key": key },
    });

    expect(first.statusCode).toBe(202);
    expect(second.statusCode).toBe(202);
    const a = first.json() as { orderId: string };
    const b = second.json() as { orderId: string };
    expect(a.orderId).toBe(b.orderId);
  });
});
