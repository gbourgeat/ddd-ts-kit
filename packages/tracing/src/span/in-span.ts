import { context, trace, type Context, type Span, type SpanOptions } from '@opentelemetry/api';
import { markSpanFailed } from './mark-span-failed';
import { tracer } from './tracer';

export interface SpanStart {
  readonly name: string;
  readonly options?: SpanOptions;
  /** Defaults to the active context. */
  readonly parent?: Context;
  /** What the span says of a failure. Defaults to `markSpanFailed`: status ERROR, class and code. */
  readonly onFailure?: (span: Span, error: unknown) => void;
}

/** Runs asynchronous work in a span that ends with it. A failure goes on untouched. */
export async function inSpan<T>(start: SpanStart, work: (span: Span) => Promise<T>): Promise<T> {
  const parent = start.parent ?? context.active();
  const span = tracer().startSpan(start.name, start.options ?? {}, parent);

  try {
    return await context.with(trace.setSpan(parent, span), () => work(span));
  } catch (error) {
    (start.onFailure ?? markSpanFailed)(span, error);

    throw error;
  } finally {
    span.end();
  }
}
