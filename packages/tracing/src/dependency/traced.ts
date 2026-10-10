import { SpanKind, context, trace, type Attributes } from '@opentelemetry/api';
import { admitDependencySpan } from '../local-root/admit-dependency-span.js';
import { isThenable } from '../span/is-thenable.js';
import { markSpanFailed } from '../span/mark-span-failed.js';
import { tracer } from '../span/tracer.js';
import type { Method } from './method.js';

// Shared by every instance of a class: one call returning a thenable teaches them all.
const learnedAsync = new WeakSet<Method>();

/** The method that runs `original` in a span of the given name, once it is known to be async. */
export function traced(original: Method, spanName: string, attributes: Attributes): Method {
  const declaredAsync = original.constructor.name === 'AsyncFunction';

  const wrapper: Method = function (this: unknown, ...args: unknown[]): unknown {
    const call = (): unknown => original.apply(this, args);

    if (!declaredAsync && !learnedAsync.has(original)) return learningAsync(original, call);

    if (!admitDependencySpan(spanName)) return call();

    return inSpan(call, spanName, attributes);
  };

  Object.defineProperty(wrapper, 'name', { value: original.name, configurable: true });

  return wrapper;
}

function learningAsync(original: Method, call: () => unknown): unknown {
  const result = call();

  if (isThenable(result)) learnedAsync.add(original);

  return result;
}

function inSpan(call: () => unknown, spanName: string, attributes: Attributes): unknown {
  const parent = context.active();
  const span = tracer().startSpan(spanName, { kind: SpanKind.INTERNAL, attributes }, parent);
  let result: unknown;

  try {
    result = context.with(trace.setSpan(parent, span), call);
  } catch (error) {
    markSpanFailed(span, error);
    span.end();

    throw error;
  }

  if (!isThenable(result)) {
    span.end();

    return result;
  }

  return result.then(
    (value) => {
      span.end();

      return value;
    },
    (error: unknown) => {
      markSpanFailed(span, error);
      span.end();

      throw error;
    },
  );
}
