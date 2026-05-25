import { trace, context, SpanStatusCode, type Span } from "@opentelemetry/api";
import { BasicTracerProvider } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";

/**
 * Lightweight OpenTelemetry setup for the challenge.
 * In production you would export to OTLP/Jaeger/Datadog Agent.
 * Here spans are recorded in-process (stub export) but still create real parent/child relationships.
 */
let initialized = false;

export function initTracing(): void {
  if (initialized) return;
  const Provider =
    process.env.NODE_ENV === "test"
      ? BasicTracerProvider
      : NodeTracerProvider;
  const provider = new Provider();
  provider.register();
  initialized = true;
}

export const tracer = trace.getTracer("casecellshop-backend");

export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, string | number | boolean>,
): Promise<T> {
  return tracer.startActiveSpan(name, async (span) => {
    try {
      if (attributes) {
        for (const [k, v] of Object.entries(attributes)) {
          span.setAttribute(k, v);
        }
      }
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      span.end();
    }
  });
}

export { context };
