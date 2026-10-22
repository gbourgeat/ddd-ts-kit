import { context } from '@opentelemetry/api';
import { contextWithTraceparent } from './context-with-traceparent';

/**
 * Runs `fn` so that spans it starts continue the trace named by `traceparent`. With a
 * missing or malformed value, `fn` runs in the current context.
 */
export function runWithTraceparent<T>(traceparent: string | undefined, fn: () => T): T {
  return context.with(contextWithTraceparent(context.active(), traceparent), fn);
}
