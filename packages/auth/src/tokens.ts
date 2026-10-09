import { token } from '@ddd-ts-kit/kernel/declarations';
import type { Authenticator } from './authentication.js';
import type { AuthorizationMap } from './authorization-map.js';
import type { Authorizer } from './authorizer.js';
import type { Access } from './policy.js';

/*
 * The tokens live here, away from the module that binds them, so that a handler of the
 * application layer names `ACCESS` in its dependency list without importing a container.
 */
export const AUTHORIZER = token<Authorizer>('auth.Authorizer');
export const AUTHENTICATOR = token<Authenticator>('auth.Authenticator');
/** Built from what the use cases declared: `.requires(...)`, `.public()`, `@Requires`, `@Public`. */
export const AUTHORIZATION_MAP = token<AuthorizationMap>('auth.AuthorizationMap');
/** What handlers depend on for the rules that need the loaded element. */
export const ACCESS = token<Access>('auth.Access');
