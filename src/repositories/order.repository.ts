import type { Order, OrderStatus } from "../types/index.js";

export class OrderRepository {
  private readonly orders = new Map<string, Order>();

  create(order: Order): void {
    this.orders.set(order.orderId, { ...order });
  }

  findById(orderId: string): Order | undefined {
    const order = this.orders.get(orderId);
    return order ? { ...order } : undefined;
  }

  updateStatus(
    orderId: string,
    status: OrderStatus,
    failureReason?: string,
  ): Order | undefined {
    const order = this.orders.get(orderId);
    if (!order) return undefined;
    order.status = status;
    order.updatedAt = new Date().toISOString();
    if (failureReason) order.failureReason = failureReason;
    this.orders.set(orderId, order);
    return { ...order };
  }

  clear(): void {
    this.orders.clear();
  }
}
