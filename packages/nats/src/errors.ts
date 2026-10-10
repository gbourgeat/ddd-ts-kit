import { errorCode } from '@ddd-ts-kit/events';

/** No live connection: the first one failed, or a reconnection is pending. */
export class BrokerUnavailableError extends Error {
  readonly code = 'BROKER_UNAVAILABLE';

  /** `reason` is the code of what made the server unreachable, never a message. */
  constructor(readonly reason: string) {
    super(`The broker is unavailable (${reason})`);
    this.name = 'BrokerUnavailableError';
  }
}

/**
 * The stream did not acknowledge the message in time: it may or may not hold it. Publish
 * again; inside the duplicate window the stream drops the second copy.
 */
export class PublishNotAcknowledgedError extends Error {
  readonly code = 'PUBLISH_NOT_ACKNOWLEDGED';

  constructor(
    readonly eventId: string,
    readonly reason: string,
  ) {
    super(`The stream did not acknowledge event ${eventId} (${reason})`);
    this.name = 'PublishNotAcknowledgedError';
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
 * What may be reported about a caught error. JetStream answers a refused request with a
 * numeric error code (`10058` for a stream that exists with another configuration): it
 * becomes `JETSTREAM_10058`. A connection error wraps the system error: its code
 * (`ECONNREFUSED`) is the one reported. Never the message.
 */
export function failureCode(error: unknown): string {
  if (typeof error !== 'object' || error === null) {
    return errorCode(error);
  }
  if ('code' in error && typeof error.code === 'number' && Number.isInteger(error.code)) {
    return `JETSTREAM_${String(error.code)}`;
  }
  const cause: unknown = 'cause' in error ? error.cause : undefined;
  const causeCode = errorCode(cause);
  return causeCode === 'UNKNOWN_ERROR' || causeCode === 'Error' ? errorCode(error) : causeCode;
}
