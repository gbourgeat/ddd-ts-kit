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
  | 'UNKNOWN_FAKE'
  | 'UNDECLARED_AUTHORIZATION'
  | 'AUTHORIZATION_NOT_ENFORCED'
  | 'UNDECLARED_CLASS'
  | 'DISCOVERY_FAILED'
  | 'NOTHING_DECLARED'
  | 'MISPLACED_DECLARATION';

/** A mistake in the composition root. Never a business failure, hence not a DomainError. */
export class WiringError extends Error {
  constructor(
    readonly code: WiringErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'WiringError';
  }
}
