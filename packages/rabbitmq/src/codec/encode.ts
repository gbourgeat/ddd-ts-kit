import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import { CORRELATION_HEADER, EVENT_VERSION_HEADER, TRACEPARENT_HEADER } from './headers.js';
import type { Publication } from './publication.js';

/**
 * The body is the whole envelope as JSON, so any AMQP client can consume it. Properties and
 * headers repeat what a broker, a tracer or an operator needs without opening the body.
 */
export function encode(event: IntegrationEvent): Publication {
  return {
    content: Buffer.from(JSON.stringify(event)),
    properties: {
      persistent: true,
      contentType: 'application/json',
      messageId: event.id,
      type: event.type,
      ...(event.correlationId === undefined ? {} : { correlationId: event.correlationId }),
      headers: {
        [EVENT_VERSION_HEADER]: event.version,
        ...(event.traceparent === undefined ? {} : { [TRACEPARENT_HEADER]: event.traceparent }),
        ...(event.correlationId === undefined ? {} : { [CORRELATION_HEADER]: event.correlationId }),
      },
    },
  };
}
