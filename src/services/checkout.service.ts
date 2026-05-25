import { randomUUID } from "node:crypto";
import type { CacheStore } from "../cache/cache.interface.js";
import { ProductLockManager } from "../locks/product.locks.js";
import { checkoutStartedTotal } from "../observability/metrics.js";
import { childLogger } from "../observability/logger.js";
import { getRequestContext } from "../observability/request-context.js";
import { withSpan } from "../observability/tracing.js";
import {
  publishCheckoutJob,
  type CheckoutQueuePublisher,
} from "../queue/checkout.queue.js";
import type { OrderRepository } from "../repositories/order.repository.js";
import type { ProductRepository } from "../repositories/product.repository.js";
import type {
  CheckoutRequest,
  CheckoutResponse,
  Order,
} from "../types/index.js";
import { IdempotencyService } from "./idempotency.service.js";

export class OutOfStockError extends Error {
  constructor(productId: string) {
    super(`Product ${productId} is out of stock`);
    this.name = "OutOfStockError";
  }
}

export class InvalidCheckoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidCheckoutError";
  }
}

export class CheckoutService {
  private readonly idempotency: IdempotencyService;
  private readonly locks = new ProductLockManager();

  constructor(
    private readonly productRepository: ProductRepository,
    private readonly orderRepository: OrderRepository,
    private readonly cache: CacheStore,
    private readonly queuePublisher: CheckoutQueuePublisher,
  ) {
    this.idempotency = new IdempotencyService(cache);
  }

  async startCheckout(
    body: CheckoutRequest,
    idempotencyKey?: string,
  ): Promise<CheckoutResponse> {
    const ctx = getRequestContext();
    const log = childLogger({
      requestId: ctx?.requestId,
      correlationId: ctx?.correlationId,
    });

    if (idempotencyKey) {
      const existing = await this.idempotency.get(idempotencyKey);
      if (existing) {
        log.info({
          orderId: existing.orderId,
          msg: "idempotent checkout replay",
        });
        return existing;
      }
    }

    return withSpan(
      "checkout.start",
      async (span) => {
        this.validateRequest(body);

        const orderId = `ord_${randomUUID()}`;
        span.setAttribute("orderId", orderId);
        log.info({ orderId, msg: "checkout started" });

        await withSpan("checkout.reserveStock", async () => {
          const productIds = [
            ...new Set(body.items.map((i) => i.productId)),
          ].sort();
          for (const productId of productIds) {
            const mutex = this.locks.getMutex(productId);
            await mutex.runExclusive(async () => {
              const itemsForProduct = body.items.filter(
                (i) => i.productId === productId,
              );
              const totalQty = itemsForProduct.reduce(
                (sum, i) => sum + i.quantity,
                0,
              );
              const product = this.productRepository.findById(productId);
              if (!product) {
                throw new InvalidCheckoutError(
                  `Unknown product: ${productId}`,
                );
              }
              if (product.stock < totalQty) {
                throw new OutOfStockError(productId);
              }
              product.stock -= totalQty;
              this.productRepository.save(product);
            });
          }
        });

        const order: Order = {
          orderId,
          status: "processing",
          items: body.items,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        this.orderRepository.create(order);

        await withSpan("queue.publish", async (qSpan) => {
          qSpan.setAttribute("orderId", orderId);
          await publishCheckoutJob(this.queuePublisher, orderId);
        });

        const response: CheckoutResponse = {
          orderId,
          status: "processing",
        };

        if (idempotencyKey) {
          await this.idempotency.save(idempotencyKey, response);
        }

        checkoutStartedTotal.inc();
        log.info({ orderId, msg: "checkout accepted" });
        return response;
      },
      { itemCount: body.items.length },
    );
  }

  private validateRequest(body: CheckoutRequest): void {
    if (!body.items?.length) {
      throw new InvalidCheckoutError("items must not be empty");
    }
    for (const item of body.items) {
      if (!item.productId || item.quantity < 1) {
        throw new InvalidCheckoutError(
          "each item needs productId and quantity >= 1",
        );
      }
    }
  }
}
