import { context, trace, type Attributes } from '@opentelemetry/api';
import { isThenable } from './is-thenable';
import { markSpanFailed } from './mark-span-failed';
import { tracer } from './tracer';

/**
 * Runs `fn` in a span. For the composition root and platform code only (a migration, a
 * scheduled job, a startup step): domain and application code never call it, adapters
 * are wrapped with `traceDependency` instead. Attributes are the caller's
 * responsibility: no user data, no secrets.
 */
export function withSpan<T>(name: string, fn: () => T, attributes?: Attributes): T {
  const parent = context.active();
  const span = tracer().startSpan(name, attributes === undefined ? {} : { attributes }, parent);
  let result: T;

  try {
    result = context.with(trace.setSpan(parent, span), fn);
  } catch (error) {
    markSpanFailed(span, error);
    span.end();

    throw error;
  }

  if (!isThenable(result)) {
    span.end();

    return result;
  }

  // The promise is observed, not replaced: the caller keeps the object `fn` returned.
  result.then(
    () => {
      span.end();
    },
    (error: unknown) => {
      markSpanFailed(span, error);
      span.end();
    },
  );

  return result;
}
