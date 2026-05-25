import type { FastifyInstance } from "fastify";
import { childLogger } from "../observability/logger.js";
import { getRequestContext } from "../observability/request-context.js";
import {
  CheckoutService,
  InvalidCheckoutError,
  OutOfStockError,
} from "../services/checkout.service.js";
import type { CheckoutRequest } from "../types/index.js";

export async function checkoutRoutes(
  app: FastifyInstance,
  checkoutService: CheckoutService,
): Promise<void> {
  app.post(
    "/checkout",
    {
      schema: {
        tags: ["checkout"],
        summary: "Start async checkout",
        headers: {
          type: "object",
          properties: {
            "idempotency-key": { type: "string" },
          },
        },
        body: {
          type: "object",
          required: ["items"],
          properties: {
            items: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: ["productId", "quantity"],
                properties: {
                  productId: { type: "string" },
                  quantity: { type: "integer", minimum: 1 },
                },
              },
            },
          },
        },
        response: {
          202: {
            type: "object",
            properties: {
              orderId: { type: "string" },
              status: { type: "string", enum: ["processing"] },
            },
          },
          409: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
              requestId: { type: "string" },
            },
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
              requestId: { type: "string" },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const ctx = getRequestContext();
      const idempotencyKey = (req.headers["idempotency-key"] as string) ?? undefined;
      const body = req.body as CheckoutRequest;

      try {
        const result = await checkoutService.startCheckout(
          body,
          idempotencyKey,
        );
        if (ctx) ctx.orderId = result.orderId;
        childLogger({
          requestId: ctx?.requestId,
          correlationId: ctx?.correlationId,
          orderId: result.orderId,
        }).info({ msg: "checkout response" });
        return reply.status(202).send(result);
      } catch (err) {
        if (err instanceof OutOfStockError) {
          return reply.status(409).send({
            error: "OUT_OF_STOCK",
            message: err.message,
            requestId: ctx?.requestId,
          });
        }
        if (err instanceof InvalidCheckoutError) {
          return reply.status(400).send({
            error: "INVALID_CHECKOUT",
            message: err.message,
            requestId: ctx?.requestId,
          });
        }
        throw err;
      }
    },
  );
}
