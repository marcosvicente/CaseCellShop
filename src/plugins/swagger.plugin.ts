import { readFileSync } from "node:fs";
import { join } from "node:path";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { FastifyInstance } from "fastify";

const OPENAPI_PATH = join(process.cwd(), "openapi.yaml");

export async function registerSwagger(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    mode: "static",
    specification: {
      path: OPENAPI_PATH,
      baseDir: process.cwd(),
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
      displayRequestDuration: true,
      tryItOutEnabled: true,
      persistAuthorization: false,
      filter: true,
    },
    staticCSP: true,
  });

  app.get("/openapi.yaml", async (_req, reply) => {
    const spec = readFileSync(OPENAPI_PATH, "utf8");
    return reply.type("application/yaml").send(spec);
  });

  app.get("/openapi.json", async (_req, reply) => {
    return reply.redirect("/docs/json");
  });

  app.get("/", async (_req, reply) => {
    return reply.redirect("/docs");
  });
}
