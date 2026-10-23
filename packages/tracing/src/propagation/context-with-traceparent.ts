import { trace, type Context } from '@opentelemetry/api';
import { spanContextFromTraceparent } from './span-context-from-traceparent';

/** `base` with the remote span as parent, or `base` itself when there is none. */
export function contextWithTraceparent(base: Context, traceparent: string | undefined): Context {
  const remote = traceparent === undefined ? undefined : spanContextFromTraceparent(traceparent);

  return remote === undefined ? base : trace.setSpanContext(base, remote);
}
