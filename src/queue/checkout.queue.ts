import { Queue, Worker } from "bullmq";
import type { RedisClient } from "../cache/redis.cache.js";

export const CHECKOUT_QUEUE_NAME = "checkout";

export type CheckoutJobData = {
  orderId: string;
};

export function createCheckoutQueue(redis: RedisClient): Queue<CheckoutJobData> {
  return new Queue<CheckoutJobData>(CHECKOUT_QUEUE_NAME, {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  });
}

/** In-process queue for tests and USE_IN_MEMORY mode */
export class InMemoryCheckoutQueue {
  private readonly handlers: Array<(data: CheckoutJobData) => Promise<void>> = [];

  onProcess(handler: (data: CheckoutJobData) => Promise<void>): void {
    this.handlers.push(handler);
  }

  async add(data: CheckoutJobData): Promise<void> {
    setImmediate(async () => {
      for (const handler of this.handlers) {
        await handler(data);
      }
    });
  }

  async close(): Promise<void> {
    this.handlers.length = 0;
  }
}

export type CheckoutQueuePublisher =
  | { mode: "bullmq"; queue: Queue<CheckoutJobData> }
  | { mode: "memory"; queue: InMemoryCheckoutQueue };

export async function publishCheckoutJob(
  publisher: CheckoutQueuePublisher,
  orderId: string,
): Promise<void> {
  if (publisher.mode === "bullmq") {
    await publisher.queue.add("process-order", { orderId });
    return;
  }
  await publisher.queue.add({ orderId });
}
