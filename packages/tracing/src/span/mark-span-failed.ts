import { SpanStatusCode, isSpanContextValid, type Attributes, type Span } from '@opentelemetry/api';
import { constructorName } from './constructor-name.js';
import { failedTraces } from './failed-traces.js';
import { refusalCode } from './refusal-code.js';

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Deliberately no `recordException` and no status message: both would carry the message. */
export function markSpanFailed(span: Span, error: unknown): void {
  span.setStatus({ code: SpanStatusCode.ERROR });
  span.setAttributes(errorAttributes(error));
  remember(span, error);
}

/**
 * What a span may say about a failure. Messages and stacks quote data (ids, emails,
 * SQL), so only an identifier-shaped class name and a code-shaped `code` get through.
 */
function errorAttributes(error: unknown): Attributes {
  if (typeof error !== 'object' || error === null) return {};

  const className = constructorName(error);

  return { ...(isIdentifier(className) ? { 'error.type': className } : {}), ...refusalCode(error) };
}

function isIdentifier(value: unknown): value is string {
  return typeof value === 'string' && IDENTIFIER.test(value);
}

/** The innermost span sees the error first: the trace it names is the one the failure happened in. */
function remember(span: Span, error: unknown): void {
  const spanContext = span.spanContext();

  if (typeof error !== 'object' || error === null || failedTraces.has(error)) return;

  if (isSpanContextValid(spanContext)) failedTraces.set(error, spanContext.traceId);
}
