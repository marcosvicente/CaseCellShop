import { withSpan } from "../observability/tracing.js";
import type { OrderRepository } from "../repositories/order.repository.js";
import type { CheckoutResponse, Order } from "../types/index.js";

export class OrderNotFoundError extends Error {
  constructor(orderId: string) {
    super(`Order ${orderId} not found`);
    this.name = "OrderNotFoundError";
  }
}

export class OrdersService {
  constructor(private readonly orderRepository: OrderRepository) {}

  async getStatus(orderId: string): Promise<CheckoutResponse & { items?: Order["items"] }> {
    return withSpan(
      "orders.getStatus",
      async () => {
        const order = this.orderRepository.findById(orderId);
        if (!order) throw new OrderNotFoundError(orderId);
        return {
          orderId: order.orderId,
          status: order.status,
          items: order.items,
          ...(order.failureReason
            ? { failureReason: order.failureReason }
            : {}),
        };
      },
      { orderId },
    );
  }
}
