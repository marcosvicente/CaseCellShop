import { describe, it, expect } from "vitest";
import { apiInject, getTestContext } from "./helpers/test-app.js";

describe("concurrent checkout", () => {
  it("does not oversell limited stock (p2 stock=5)", async () => {
    const productId = "p2";
    const concurrent = 10;

    const results = await Promise.all(
      Array.from({ length: concurrent }).map(() =>
        apiInject("POST", "/checkout", {
          payload: { items: [{ productId, quantity: 1 }] },
        }),
      ),
    );

    const accepted = results.filter((r) => r.statusCode === 202);
    const rejected = results.filter((r) => r.statusCode === 409);

    expect(accepted.length).toBe(5);
    expect(rejected.length).toBe(5);

    const ctx = getTestContext();
    const product = ctx.productRepository.findById(productId);
    expect(product?.stock).toBe(0);
    expect(product?.stock).toBeGreaterThanOrEqual(0);
  });

  it("deducts stock atomically under parallel multi-qty requests", async () => {
    const productId = "p1";
    const initial = getTestContext().productRepository.findById(productId)!;
    const stock = initial.stock;

    const results = await Promise.all(
      Array.from({ length: stock + 3 }).map(() =>
        apiInject("POST", "/checkout", {
          payload: { items: [{ productId, quantity: 1 }] },
        }),
      ),
    );

    const ok = results.filter((r) => r.statusCode === 202).length;
    const fail = results.filter((r) => r.statusCode === 409).length;

    expect(ok).toBe(stock);
    expect(fail).toBe(3);

    const remaining =
      getTestContext().productRepository.findById(productId)!.stock;
    expect(remaining).toBe(0);
  });
});
