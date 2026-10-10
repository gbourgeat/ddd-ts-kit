import { headers as emptyHeaders } from '@nats-io/transport-node';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import {
  CORRELATION_HEADER,
  EVENT_TYPE_HEADER,
  EVENT_VERSION_HEADER,
  TRACEPARENT_HEADER,
} from './headers.js';
import type { Publication } from './publication.js';

/**
 * The body is the whole envelope as JSON, so any NATS client can consume it. The headers
 * repeat what the stream, a tracer or an operator needs without opening the body.
 */
export function encode(event: IntegrationEvent): Publication {
  const headers = emptyHeaders();

  headers.set(EVENT_TYPE_HEADER, event.type);
  headers.set(EVENT_VERSION_HEADER, String(event.version));

  if (event.traceparent !== undefined) {
    headers.set(TRACEPARENT_HEADER, event.traceparent);
  }

  if (event.correlationId !== undefined) {
    headers.set(CORRELATION_HEADER, event.correlationId);
  }

  return { data: JSON.stringify(event), messageId: event.id, headers };
}
