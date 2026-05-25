import { Worker } from "bullmq";
import type { RedisClient } from "../cache/redis.cache.js";
import {
  checkoutCompletedTotal,
  checkoutFailedTotal,
  workerDurationMs,
  workerJobsTotal,
} from "../observability/metrics.js";
import { childLogger } from "../observability/logger.js";
import { withSpan } from "../observability/tracing.js";
import type { OrderRepository } from "../repositories/order.repository.js";
import {
  CHECKOUT_QUEUE_NAME,
  type CheckoutJobData,
  type InMemoryCheckoutQueue,
} from "../queue/checkout.queue.js";

const ERP_DELAY_MS = 150;

async function fakeERPIntegration(orderId: string): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ERP_DELAY_MS));
  if (orderId.endsWith("_fail_erp")) {
    throw new Error("ERP_UNAVAILABLE");
  }
}

export async function processCheckoutJob(
  orderId: string,
  orderRepository: OrderRepository,
): Promise<void> {
  const log = childLogger({ orderId });
  const end = workerDurationMs.startTimer();

  await withSpan(
    "worker.processCheckout",
    async (span) => {
      span.setAttribute("orderId", orderId);
      log.info({ msg: "worker job started" });

      await withSpan("worker.fakeERP", async (erpSpan) => {
        erpSpan.setAttribute("orderId", orderId);
        await fakeERPIntegration(orderId);
      });

      orderRepository.updateStatus(orderId, "completed");
      checkoutCompletedTotal.inc();
      workerJobsTotal.inc({ result: "success" });
      log.info({ msg: "order completed" });
    },
    { orderId },
  ).catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    orderRepository.updateStatus(orderId, "failed", message);
    checkoutFailedTotal.inc();
    workerJobsTotal.inc({ result: "failure" });
    log.error({ msg: "order failed", err: message });
    throw err;
  }).finally(() => {
    end();
  });
}

export function startBullWorker(
  redis: RedisClient,
  orderRepository: OrderRepository,
): Worker<CheckoutJobData> {
  return new Worker<CheckoutJobData>(
    CHECKOUT_QUEUE_NAME,
    async (job) => {
      await processCheckoutJob(job.data.orderId, orderRepository);
    },
    { connection: redis },
  );
}

export function wireInMemoryWorker(
  queue: InMemoryCheckoutQueue,
  orderRepository: OrderRepository,
): void {
  queue.onProcess(async (data) => {
    try {
      await processCheckoutJob(data.orderId, orderRepository);
    } catch {
      // metrics and status already updated in processCheckoutJob
    }
  });
}
