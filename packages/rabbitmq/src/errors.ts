import { errorCode } from '@ddd-ts-kit/events';

/** No live connection: the first one failed, or a reconnection is pending. */
export class BrokerUnavailableError extends Error {
  readonly code = 'BROKER_UNAVAILABLE';

  /** `reason` is the code of what made the broker unreachable, never a message. */
  constructor(readonly reason: string) {
    super(`The broker is unavailable (${reason})`);
    this.name = 'BrokerUnavailableError';
  }
}

/** The broker did not confirm the message: it may or may not have it. Publish again. */
export class PublishNotConfirmedError extends Error {
  readonly code = 'PUBLISH_NOT_CONFIRMED';

  constructor(readonly eventId: string) {
    super(`The broker did not confirm event ${eventId}`);
    this.name = 'PublishNotConfirmedError';
  }
}

/** Raised under `onUnroutable: 'fail'` when no queue is bound for the type of the event. */
export class UnroutableEventError extends Error {
  readonly code = 'UNROUTABLE_EVENT';

  constructor(
    readonly eventId: string,
    readonly eventType: string,
  ) {
    super(`No queue is bound for ${eventType}: event ${eventId} was returned by the broker`);
    this.name = 'UnroutableEventError';
  }
}

export class EventBusClosedError extends Error {
  readonly code = 'EVENT_BUS_CLOSED';

  constructor() {
    super('The event bus is closed');
    this.name = 'EventBusClosedError';
  }
}

export class ConsumerNameRequiredError extends Error {
  readonly code = 'CONSUMER_NAME_REQUIRED';

  constructor() {
    super(
      'Subscribing needs a consumer name: build the bus with `consumer`, or use `forConsumer(name)`',
    );
    this.name = 'ConsumerNameRequiredError';
  }
}

/**
 * What may be reported about a caught error. amqplib carries the AMQP reply code as a number
 * (`406` for an inequivalent declaration): it becomes `AMQP_406`. Never the message.
 */
export function failureCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const { code } = error;
    if (typeof code === 'number' && Number.isInteger(code)) {
      return `AMQP_${String(code)}`;
    }
  }
  return errorCode(error);
}
