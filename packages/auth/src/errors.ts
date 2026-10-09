import { DomainError, type MessageInfo } from '@ddd-ts-kit/kernel';

/**
 * The codes `UnauthorizedError` and `ForbiddenError` of @ddd-ts-kit/http carry, so its default
 * error mapping answers 401 and 403 for the errors below with no extra wiring.
 */
export const UNAUTHORIZED = 'UNAUTHORIZED';
export const FORBIDDEN = 'FORBIDDEN';

/** Nobody is authenticated and the use case is not public. */
export class UnauthenticatedError extends DomainError {
  readonly code = UNAUTHORIZED;

  constructor() {
    super('Authentication is required');
  }
}

/** A credential was presented and it is not acceptable. `reason` is a stable machine code. */
export class InvalidCredentialError extends DomainError {
  readonly code = UNAUTHORIZED;

  constructor(readonly reason: string) {
    super('The credential is not valid');
  }
}

/** The actor is known and may not do this. `reason` is a stable machine code, never data. */
export class ForbiddenError extends DomainError {
  readonly code = FORBIDDEN;

  constructor(
    readonly permissionId: string,
    readonly reason: string,
  ) {
    super(`Permission ${permissionId} is not granted`);
  }
}

/**
 * A command or query reached the bus without `requires` or `publicUseCase`. A programming
 * error, not a refusal: it must fail a test, never be answered as a 403.
 */
export class UndeclaredUseCaseError extends Error {
  constructor(info: MessageInfo) {
    super(
      `The ${info.kind} ${info.name} declares no access. Declare it with requires(${info.name}, permission) or publicUseCase(${info.name}).`,
    );
    this.name = 'UndeclaredUseCaseError';
  }
}

/** A protected command or query was sent without its actor. A programming error as well. */
export class MissingActorError extends Error {
  constructor(info: MessageInfo) {
    super(
      `The ${info.kind} ${info.name} requires a permission but carries no actor. Extend AuthorizedCommand or AuthorizedQuery.`,
    );
    this.name = 'MissingActorError';
  }
}

/** The configured authorizer cannot enumerate what an actor may access. */
export class ListingNotSupportedError extends Error {
  constructor() {
    super('The authorizer does not implement listAccessible: it cannot turn a permission into an access scope');
    this.name = 'ListingNotSupportedError';
  }
}

/** Permissions, roles, policies or declarations that contradict themselves, found when they are defined. */
export class AuthorizationSetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationSetupError';
  }
}
