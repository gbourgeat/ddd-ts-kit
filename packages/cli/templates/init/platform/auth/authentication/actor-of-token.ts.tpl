import { InvalidCredentialError, actorOfClaims } from '@ddd-ts-kit/auth';
import type { Actor } from '@ddd-ts-kit/kernel';

/**
 * The actor the payload of a verified token stands for, as the kit reads claims: `sub`, the roles
 * (`realm_access.roles`, else `roles`, never `scope`), the tenant (`tenant_id`) and the profile.
 * Change it here when the tokens of the issuer say these elsewhere.
 */
export function actorOfToken(payload: unknown): Actor {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new InvalidCredentialError('NO_CLAIMS');
  }

  return actorOfClaims({ ...payload });
}
