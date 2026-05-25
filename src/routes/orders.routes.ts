import type { FastifyInstance } from "fastify";
import { childLogger } from "../observability/logger.js";
import { getRequestContext } from "../observability/request-context.js";
import { OrderNotFoundError } from "../services/orders.service.js";
import type { OrdersService } from "../services/orders.service.js";

export async function ordersRoutes(
  app: FastifyInstance,
  ordersService: OrdersService,
): Promise<void> {
  app.get(
    "/orders/:orderId/status",
    {
      schema: {
        tags: ["orders"],
        summary: "Get order processing status",
        params: {
          type: "object",
          required: ["orderId"],
          properties: {
            orderId: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              orderId: { type: "string" },
              status: {
                type: "string",
                enum: ["processing", "completed", "failed"],
              },
              failureReason: { type: "string" },
            },
          },
          404: {
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
      const { orderId } = req.params as { orderId: string };
      const ctx = getRequestContext();
      if (ctx) ctx.orderId = orderId;

      childLogger({
        requestId: ctx?.requestId,
        correlationId: ctx?.correlationId,
        orderId,
      }).info({ msg: "get order status" });

      try {
        const status = await ordersService.getStatus(orderId);
        return reply.send(status);
      } catch (err) {
        if (err instanceof OrderNotFoundError) {
          return reply.status(404).send({
            error: "ORDER_NOT_FOUND",
            message: err.message,
            requestId: ctx?.requestId,
          });
        }
        throw err;
      }
    },
  );
}
