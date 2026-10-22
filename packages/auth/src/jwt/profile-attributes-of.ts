import type { ActorAttribute } from '@ddd-ts-kit/kernel';
import type { Claims } from './claims';

/**
 * What the standard claims of OpenID Connect say of the person: `username` (`preferred_username`),
 * `email`, and `emailVerified` (`email_verified`), which says whether the provider checked that
 * the person receives mail at that address. A use case that trusts the address (an invitation
 * sent to it) reads `emailVerified` first.
 */
export function profileAttributesOf(claims: Claims): Record<string, ActorAttribute> {
  const username = claims['preferred_username'];
  const email = claims['email'];
  const verified = claims['email_verified'];

  return {
    ...(typeof username === 'string' ? { username } : {}),
    ...(typeof email === 'string' ? { email } : {}),
    ...(typeof verified === 'boolean' ? { emailVerified: verified } : {}),
  };
}
