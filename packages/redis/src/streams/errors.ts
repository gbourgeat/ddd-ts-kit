/** No live connection: the first one failed, or ioredis is between two reconnection attempts. */
export class BrokerUnavailableError extends Error {
  readonly code = 'BROKER_UNAVAILABLE';

  /** `reason` is the code of what made the server unreachable, never a message. */
  constructor(readonly reason: string) {
    super(`The server is unavailable (${reason})`);
    this.name = 'BrokerUnavailableError';
  }
}

/** The server did not acknowledge the entry: it may or may not hold it. Publish again. */
export class PublishNotConfirmedError extends Error {
  readonly code = 'PUBLISH_NOT_CONFIRMED';

  /** `reason` is the code of the failure: a transport error, or the kind of error the server answered. */
  constructor(
    readonly eventId: string,
    readonly reason: string,
  ) {
    super(`The server did not acknowledge event ${eventId} (${reason})`);
    this.name = 'PublishNotConfirmedError';
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
    super('Subscribing needs a consumer name: build the bus with `consumer`, or use `forConsumer(name)`');
    this.name = 'ConsumerNameRequiredError';
  }
}

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9_.:-]{0,63}$/;

/**
 * What may be reported about a caught error: its `code` when it carries one (`ECONNREFUSED`),
 * the kind of an error answered by the server (`REDIS_NOGROUP`, `REDIS_OOM`), else its class
 * name. Never the message, which may quote a key, a URL or payload data.
 */
export function failureCode(error: unknown): string {
  if (typeof error !== 'object' || error === null) return 'UNKNOWN_ERROR';
  if ('code' in error && typeof error.code === 'string' && IDENTIFIER.test(error.code)) return error.code;
  if (!(error instanceof Error)) return 'UNKNOWN_ERROR';
  if (error.name === 'ReplyError') return replyKind(error.message);
  return IDENTIFIER.test(error.constructor.name) ? error.constructor.name : 'UNKNOWN_ERROR';
}

/** The protocol starts an error reply with its kind in capitals: only that word is kept. */
const REPLY_KIND = /^[A-Z][A-Z0-9]{1,31}(?= |$)/;

function replyKind(reply: string): string {
  const kind = REPLY_KIND.exec(reply)?.[0];
  return kind === undefined ? 'REDIS_ERROR' : `REDIS_${kind}`;
}
