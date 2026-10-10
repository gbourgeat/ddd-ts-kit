import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import {
  CORRELATION_FIELD,
  ENVELOPE_FIELD,
  EVENT_ID_FIELD,
  EVENT_TYPE_FIELD,
  EVENT_VERSION_FIELD,
  TRACEPARENT_FIELD,
} from './entry-fields.js';

/**
 * The fields of an entry: the whole envelope as JSON, so any client of the protocol can
 * consume it, and beside it what an operator, a tracer or a filter needs without parsing it.
 */
export function encode(event: IntegrationEvent): string[] {
  return [
    EVENT_ID_FIELD,
    event.id,
    EVENT_TYPE_FIELD,
    event.type,
    EVENT_VERSION_FIELD,
    String(event.version),
    ...(event.traceparent === undefined ? [] : [TRACEPARENT_FIELD, event.traceparent]),
    ...(event.correlationId === undefined ? [] : [CORRELATION_FIELD, event.correlationId]),
    ENVELOPE_FIELD,
    JSON.stringify(event),
  ];
}
