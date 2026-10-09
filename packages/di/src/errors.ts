export type WiringErrorCode =
  | 'DUPLICATE_BINDING'
  | 'INCOMPLETE_BINDING'
  | 'NOTHING_TO_REBIND'
  | 'UNBOUND_DEPENDENCY'
  | 'UNBOUND_TOKEN'
  | 'DEPENDENCY_CYCLE'
  | 'DUPLICATE_HANDLER'
  | 'DUPLICATE_CONSUMER'
  | 'BUS_WITHOUT_REGISTER'
  | 'UNKNOWN_FAKE';

/** A mistake in the composition root. Never a business failure, hence not a DomainError. */
export class WiringError extends Error {
  constructor(
    readonly code: WiringErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'WiringError';
  }
}
