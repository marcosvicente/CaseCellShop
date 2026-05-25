import pino from "pino";
import { config } from "../config.js";

export const logger = pino({
  level: config.nodeEnv === "test" ? "silent" : "info",
  base: { service: "casecellshop-backend" },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export type LogContext = {
  requestId?: string;
  correlationId?: string;
  orderId?: string;
  [key: string]: unknown;
};

export function childLogger(ctx: LogContext) {
  return logger.child(ctx);
}
