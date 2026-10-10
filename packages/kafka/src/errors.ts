import { errorCode } from '@ddd-ts-kit/events';

/** The cluster cannot be reached, or did not answer in time. */
export class BrokerUnavailableError extends Error {
  readonly code = 'BROKER_UNAVAILABLE';

  /** `reason` is the code of what made the cluster unreachable, never a message. */
  constructor(readonly reason: string) {
    super(`The broker is unavailable (${reason})`);
    this.name = 'BrokerUnavailableError';
  }
}

/**
 * The in-sync replicas did not acknowledge the records in time: they may or may not be in
 * the log. Publish again; consumers deduplicate on the event id.
 */
export class PublishNotAcknowledgedError extends Error {
  readonly code = 'PUBLISH_NOT_ACKNOWLEDGED';

  constructor(
    /** The events of the send that failed; some of them may have been written. */
    readonly eventIds: readonly string[],
    readonly reason: string,
  ) {
    super(`The broker did not acknowledge ${String(eventIds.length)} event(s) (${reason})`);
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
 * What may be reported about an error of the client. librdkafka names its errors in `type`
 * (`ERR__MSG_TIMED_OUT`, `ERR_UNKNOWN_TOPIC_OR_PART`): that name is the code. Never the message.
 */
export function failureCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'type' in error) {
    const { type } = error;
    if (typeof type === 'string' && /^ERR_[A-Z_]+$/.test(type)) {
      return type;
    }
  }
  return errorCode(error);
}

/** Rejects with `BROKER_UNAVAILABLE` when `work` has not settled after `timeoutMs`. */
export async function within<T>(work: Promise<T>, timeoutMs: number, reason: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new BrokerUnavailableError(reason));
    }, timeoutMs);
  });
  try {
    return await Promise.race([work, expired]);
  } finally {
    clearTimeout(timer);
  }
}

/** The code of a failure of the cluster, whether the bus already named it or the client raised it. */
export function reasonOf(error: unknown): string {
  if (error instanceof BrokerUnavailableError || error instanceof PublishNotAcknowledgedError) {
    return error.reason;
  }
  return failureCode(error);
}
