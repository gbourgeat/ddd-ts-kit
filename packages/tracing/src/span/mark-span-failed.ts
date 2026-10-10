import { SpanStatusCode, type Attributes, type Span } from '@opentelemetry/api';
import { constructorName } from './constructor-name.js';

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Deliberately no `recordException` and no status message: both would carry the message. */
export function markSpanFailed(span: Span, error: unknown): void {
  span.setStatus({ code: SpanStatusCode.ERROR });
  span.setAttributes(errorAttributes(error));
}

/**
 * What a span may say about a failure. Messages and stacks quote data (ids, emails,
 * SQL), so only identifier-shaped names and codes get through.
 */
function errorAttributes(error: unknown): Attributes {
  const attributes: Attributes = {};

  if (typeof error !== 'object' || error === null) return attributes;

  const className = constructorName(error);

  if (isIdentifier(className)) attributes['error.type'] = className;

  if ('code' in error && isIdentifier(error.code)) attributes['app.error.code'] = error.code;

  return attributes;
}

function isIdentifier(value: unknown): value is string {
  return typeof value === 'string' && IDENTIFIER.test(value);
}
