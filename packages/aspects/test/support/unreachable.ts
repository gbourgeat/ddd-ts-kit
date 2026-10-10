/** A fault whose message quotes data that must never be recorded. */
export class Unreachable extends Error {
  readonly code = 'ECONNRESET';

  constructor() {
    super('Connection reset while sending card 4111-1111 to 10.0.0.7');
    this.name = 'Unreachable';
  }
}
