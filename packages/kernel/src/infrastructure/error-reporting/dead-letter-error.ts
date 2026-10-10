/**
 * An event was given up by its provider and nothing remembered what its handler threw: a
 * poison message, a publication that never succeeded, a failure seen by another process.
 * It names the provider's code, never the content of the event.
 */
export class DeadLetterError extends Error {
  constructor(
    readonly kind: string,
    readonly code: string,
  ) {
    super(`An event was given up after a ${kind} failure: ${code}`);
    this.name = 'DeadLetterError';
  }
}
