import { AsyncLocalStorage } from "node:async_hooks";

export type RequestContext = {
  requestId: string;
  correlationId: string;
  orderId?: string;
};

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

export function runWithContext<T>(
  ctx: RequestContext,
  fn: () => T,
): T {
  return requestContextStorage.run(ctx, fn);
}
