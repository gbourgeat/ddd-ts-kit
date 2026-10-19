/** A refusal of the broker as amqplib hands it over: the AMQP reply code is a number. */
export class AmqpError extends Error {
  constructor(
    readonly code: number,
    text: string,
  ) {
    super(`Channel closed by server: ${String(code)} (${text})`);
  }
}

/** What amqplib throws for an operation on a channel or a connection that is closed. */
export class IllegalOperation extends Error {}

export class ConnectionRefused extends Error {
  readonly code = 'ECONNREFUSED';

  constructor() {
    super('connect ECONNREFUSED 127.0.0.1:5672');
  }
}

export class Unsupported extends Error {
  constructor(operation: string) {
    super(`${operation} is not supported by the in-memory broker`);
  }
}
