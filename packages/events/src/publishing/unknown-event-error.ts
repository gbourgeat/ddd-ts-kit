export class UnknownEventError extends Error {
  readonly code = 'UNKNOWN_EVENT';

  constructor(
    readonly eventType: string,
    readonly eventVersion: number,
  ) {
    super(`Integration event ${eventType} v${eventVersion} is not declared in the registry`);
    this.name = 'UnknownEventError';
  }
}
