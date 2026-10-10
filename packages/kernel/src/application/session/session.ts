import type { Actor } from '../actor/actor.js';
import type { AuthenticationMethod } from './authentication-method.js';
import type { AuthenticationStrength } from './authentication-strength.js';
import type { SessionClient } from './session-client.js';
import type { SessionExtensionValues } from './session-extension-values.js';

/**
 * The authenticated session of an actor, as plain data: never the credential it came from.
 * Project fields live under `extensions`, so a standard field added later cannot collide with
 * them. They are all optional when read: the anonymous and system sessions carry none.
 */
export interface Session {
  readonly id: string;
  readonly actor: Actor;
  readonly issuedAt: Date;
  readonly expiresAt?: Date;
  readonly authenticationMethod: AuthenticationMethod;
  readonly authenticationStrength?: AuthenticationStrength;
  /** Id of the actor acting as `actor`, for support staff. Audit must record it. */
  readonly impersonatedBy?: string;
  /** BCP 47 language tag, for example `fr-FR`. */
  readonly locale?: string;
  /** IANA time zone, for example `Europe/Paris`. */
  readonly timeZone?: string;
  readonly client?: SessionClient;
  readonly extensions: SessionExtensionValues;
}
