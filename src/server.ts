import { buildApp, closeApp } from "./app.js";
import { config } from "./config.js";
import { childLogger } from "./observability/logger.js";

async function main(): Promise<void> {
  const ctx = await buildApp();
  const log = childLogger({});

  await ctx.app.listen({ port: config.port, host: config.host });
  log.info({
    msg: "server listening",
    port: config.port,
    useInMemory: config.useInMemory,
    docs: `http://${config.host === "0.0.0.0" ? "localhost" : config.host}:${config.port}/docs`,
  });

  const shutdown = async (signal: string) => {
    log.info({ msg: "shutting down", signal });
    await closeApp(ctx);
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
