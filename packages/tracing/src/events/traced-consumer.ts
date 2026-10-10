import {
  SpanKind,
  context,
  trace,
  type Attributes,
  type Context,
  type Span,
  type SpanContext,
  type SpanOptions,
} from '@opentelemetry/api';
import type { EventDelivery, IntegrationEvent, IntegrationEventCallback } from '@ddd-ts-kit/kernel';
import { CORRELATION_ID_ATTRIBUTE, ORIGIN_ATTRIBUTE } from '../local-root/correlate.js';
import { spanContextFromTraceparent } from '../propagation/span-context-from-traceparent.js';
import { inSpan, type SpanStart } from '../span/in-span.js';
import { markSpanFailed } from '../span/mark-span-failed.js';
import { OUTCOME_ATTRIBUTE } from '../span/outcome-attribute.js';
import type { ConsumerTrace } from './consumer-trace.js';
import { messagingAttributes } from './messaging-attributes.js';

export interface TracedConsumerOptions {
  /** Stable name of the consumer: the span is `process <consumer>`. Without it, `process <type>`. */
  readonly consumer?: string;
  /** Bounded context of the consumer. */
  readonly context?: string;
  /** Default `continue`. */
  readonly trace?: ConsumerTrace;
  /** The transport, when the provider does not say it with each delivery. */
  readonly system?: string;
}

export const ATTEMPT_ATTRIBUTE = 'app.messaging.attempt';

/**
 * Wraps what a provider calls at each delivery: every attempt runs in its own CONSUMER span,
 * which says which attempt it is, so a redelivery reads as one. A failed attempt is an error
 * with the code of what was thrown; the attempt after which the provider gives the event up
 * says `dead-lettered`. The span starts the unit of work: it carries the correlation id of the
 * event. Never the payload.
 */
export function tracedConsumer(
  handler: IntegrationEventCallback,
  options: TracedConsumerOptions = {},
): IntegrationEventCallback {
  return async (event, delivery) => {
    await inSpan(startOf(event, delivery, options), async (span) => {
      await handler(event, delivery);
      span.setAttribute(OUTCOME_ATTRIBUTE, 'succeeded');
    });
  };
}

function startOf(
  event: IntegrationEvent,
  delivery: EventDelivery | undefined,
  options: TracedConsumerOptions,
): SpanStart {
  const producer = event.traceparent === undefined ? undefined : spanContextFromTraceparent(event.traceparent);
  const linked = options.trace === 'link' && producer !== undefined;
  const spanOptions: SpanOptions = { kind: SpanKind.CONSUMER, attributes: attributesOf(event, delivery, options) };

  return {
    name: `process ${options.consumer ?? event.type}`,
    options: linked ? { ...spanOptions, root: true, links: [{ context: producer }] } : spanOptions,
    parent: parentOf(producer, linked),
    onFailure: (span, error) => {
      failed(span, error, delivery);
    },
  };
}

function parentOf(producer: SpanContext | undefined, linked: boolean): Context {
  const active = context.active();

  return producer === undefined || linked ? active : trace.setSpanContext(active, producer);
}

function attributesOf(
  event: IntegrationEvent,
  delivery: EventDelivery | undefined,
  options: TracedConsumerOptions,
): Attributes {
  const consumer = options.consumer ?? delivery?.consumer;

  return {
    ...messagingAttributes({ name: 'process', type: 'process', system: delivery?.system ?? options.system }, event),
    ...(consumer === undefined ? {} : { 'messaging.consumer.group.name': consumer }),
    ...(options.context === undefined ? {} : { 'app.context': options.context }),
    ...deliveryAttributes(delivery),
    [CORRELATION_ID_ATTRIBUTE]: event.correlationId ?? event.id,
    [ORIGIN_ATTRIBUTE]: 'event',
  };
}

function deliveryAttributes(delivery: EventDelivery | undefined): Attributes {
  const attempt = delivery?.attempt ?? 1;

  return {
    ...(delivery?.destination === undefined ? {} : { 'app.messaging.source': delivery.destination }),
    [ATTEMPT_ATTRIBUTE]: attempt,
    ...(attempt > 1 ? { 'app.messaging.redelivered': true } : {}),
  };
}

function failed(span: Span, error: unknown, delivery: EventDelivery | undefined): void {
  const last = delivery?.maxAttempts !== undefined && delivery.attempt >= delivery.maxAttempts;

  markSpanFailed(span, error);
  span.setAttribute(OUTCOME_ATTRIBUTE, last ? 'dead-lettered' : 'failed');
}
