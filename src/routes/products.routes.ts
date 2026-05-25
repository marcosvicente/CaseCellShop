import type { FastifyInstance } from "fastify";
import { childLogger } from "../observability/logger.js";
import { getRequestContext } from "../observability/request-context.js";
import type { ProductsService } from "../services/products.service.js";

export async function productsRoutes(
  app: FastifyInstance,
  productsService: ProductsService,
): Promise<void> {
  app.get(
    "/products",
    {
      schema: {
        tags: ["products"],
        summary: "List product catalog (cached)",
        response: {
          200: {
            type: "object",
            properties: {
              products: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    price: { type: "number" },
                    stock: { type: "integer" },
                  },
                  required: ["id", "name", "price", "stock"],
                },
              },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const ctx = getRequestContext();
      const log = childLogger({
        requestId: ctx?.requestId,
        correlationId: ctx?.correlationId,
      });
      log.info({ msg: "list products" });
      const products = await productsService.listProducts();
      return reply.send({ products });
    },
  );
}
