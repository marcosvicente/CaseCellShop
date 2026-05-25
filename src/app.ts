import { randomUUID } from "node:crypto";
import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { registerSwagger } from "./plugins/swagger.plugin.js";
import { MemoryCache } from "./cache/memory.cache.js";
import {
  createRedisClient,
  RedisCache,
  type RedisClient,
} from "./cache/redis.cache.js";
import { config } from "./config.js";
import { httpRequestDurationMs } from "./observability/metrics.js";
import { childLogger } from "./observability/logger.js";
import {
  getRequestContext,
  requestContextStorage,
} from "./observability/request-context.js";
import { initTracing } from "./observability/tracing.js";
import { ProductRepository } from "./repositories/product.repository.js";
import { OrderRepository } from "./repositories/order.repository.js";
import {
  createCheckoutQueue,
  InMemoryCheckoutQueue,
  type CheckoutQueuePublisher,
} from "./queue/checkout.queue.js";
import { healthRoutes } from "./routes/health.routes.js";
import { metricsRoutes } from "./routes/metrics.routes.js";
import { productsRoutes } from "./routes/products.routes.js";
import { checkoutRoutes } from "./routes/checkout.routes.js";
import { ordersRoutes } from "./routes/orders.routes.js";
import { ProductsService } from "./services/products.service.js";
import { CheckoutService } from "./services/checkout.service.js";
import { OrdersService } from "./services/orders.service.js";
import {
  startBullWorker,
  wireInMemoryWorker,
} from "./workers/checkout.worker.js";
import type { Worker } from "bullmq";

export type AppContext = {
  app: FastifyInstance;
  redis?: RedisClient;
  worker?: Worker;
  memoryQueue?: InMemoryCheckoutQueue;
  productRepository: ProductRepository;
  orderRepository: OrderRepository;
};

export async function buildApp(): Promise<AppContext> {
  initTracing();

  const productRepository = new ProductRepository();
  const orderRepository = new OrderRepository();

  let cache: MemoryCache | RedisCache;
  let redis: RedisClient | undefined;
  let queuePublisher: CheckoutQueuePublisher;
  let worker: Worker | undefined;
  let memoryQueue: InMemoryCheckoutQueue | undefined;

  if (config.useInMemory) {
    cache = new MemoryCache();
    memoryQueue = new InMemoryCheckoutQueue();
    wireInMemoryWorker(memoryQueue, orderRepository);
    queuePublisher = { mode: "memory", queue: memoryQueue };
  } else {
    redis = createRedisClient(config.redisUrl);
    cache = new RedisCache(redis);
    const queue = createCheckoutQueue(redis);
    queuePublisher = { mode: "bullmq", queue };
    worker = startBullWorker(redis, orderRepository);
  }

  const productsService = new ProductsService(productRepository, cache);
  const checkoutService = new CheckoutService(
    productRepository,
    orderRepository,
    cache,
    queuePublisher,
  );
  const ordersService = new OrdersService(orderRepository);

  const app = Fastify({
    logger: false,
    requestIdHeader: "x-request-id",
    genReqId: (req) =>
      (req.headers["x-request-id"] as string) ?? randomUUID(),
  });

  await app.register(cors, { origin: true });
  await registerSwagger(app);

  app.addHook("onRequest", async (req, reply) => {
    const requestId = req.id;
    const correlationId =
      (req.headers["x-correlation-id"] as string) ?? requestId;
    reply.header("x-request-id", requestId);
    reply.header("x-correlation-id", correlationId);
    childLogger({ requestId, correlationId }).info({
      msg: "request started",
      method: req.method,
      url: req.url,
    });
  });

  app.addHook("onResponse", async (req, reply) => {
    const ctx = getRequestContext();
    const route = req.routeOptions?.url ?? req.url;
    httpRequestDurationMs.observe(
      {
        method: req.method,
        route,
        status_code: String(reply.statusCode),
      },
      reply.elapsedTime,
    );
    childLogger({
      requestId: ctx?.requestId ?? req.id,
      correlationId: ctx?.correlationId,
      orderId: ctx?.orderId,
    }).info({
      msg: "request completed",
      statusCode: reply.statusCode,
      durationMs: reply.elapsedTime,
    });
  });

  app.addHook("preHandler", async (req) => {
    const requestId = req.id;
    const correlationId =
      (req.headers["x-correlation-id"] as string) ?? requestId;
    return new Promise<void>((resolve) => {
      requestContextStorage.run({ requestId, correlationId }, () => resolve());
    });
  });

  await healthRoutes(app);
  await metricsRoutes(app);
  await productsRoutes(app, productsService);
  await checkoutRoutes(app, checkoutService);
  await ordersRoutes(app, ordersService);

  app.setErrorHandler((err, req, reply) => {
    const ctx = getRequestContext();
    const error = err instanceof Error ? err : new Error(String(err));
    const validation = (err as { validation?: unknown }).validation;
    if (validation) {
      return reply.status(400).send({
        error: "INVALID_CHECKOUT",
        message: error.message,
        requestId: ctx?.requestId ?? req.id,
      });
    }
    childLogger({
      requestId: ctx?.requestId ?? req.id,
      correlationId: ctx?.correlationId,
    }).error({ msg: "unhandled error", err: error.message });
    reply.status(500).send({
      error: "INTERNAL_ERROR",
      message: "Unexpected server error",
      requestId: ctx?.requestId,
    });
  });

  return {
    app,
    redis,
    worker,
    memoryQueue,
    productRepository,
    orderRepository,
  };
}

export async function closeApp(ctx: AppContext): Promise<void> {
  await ctx.app.close();
  await ctx.worker?.close();
  await ctx.memoryQueue?.close();
  await ctx.redis?.quit();
}
