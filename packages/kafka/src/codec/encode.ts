import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import {
  CORRELATION_HEADER,
  EVENT_ID_HEADER,
  EVENT_TYPE_HEADER,
  EVENT_VERSION_HEADER,
  TRACEPARENT_HEADER,
} from './headers.js';
import type { OutgoingRecord } from './outgoing-record.js';
import type { Routing } from './routing.js';

/**
 * The value is the whole envelope as JSON, so any Kafka client can consume it. The headers
 * repeat what a router, a tracer or an operator needs without opening the value.
 */
export function encode(event: IntegrationEvent, routing: Routing): OutgoingRecord {
  return {
    topic: routing.topicOf(event.type),
    message: {
      key: routing.keyOf(event) ?? null,
      value: JSON.stringify(event),
      headers: {
        [EVENT_ID_HEADER]: event.id,
        [EVENT_TYPE_HEADER]: event.type,
        [EVENT_VERSION_HEADER]: String(event.version),
        ...(event.traceparent === undefined ? {} : { [TRACEPARENT_HEADER]: event.traceparent }),
        ...(event.correlationId === undefined ? {} : { [CORRELATION_HEADER]: event.correlationId }),
      },
    },
  };
}
