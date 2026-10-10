import type { Actor } from '@ddd-ts-kit/kernel';

/**
 * Who is calling. A platform concern at the boundary: an adapter verifies the credential and
 * produces an actor. Answers the anonymous actor when there is no credential, and raises
 * `InvalidCredentialError` when one is presented and not acceptable.
 */
export abstract class Authenticator {
  static readonly tokenKey: string = 'auth.Authenticator';

  abstract authenticate(credential: string | undefined): Promise<Actor>;
}
