import type { Config } from '../config';
import type { RenderContext } from '../templating';
import { one } from './one';

/** Authentication happens at the HTTP boundary: without one there is nobody to identify. */
export function authenticationVars(config: Config): RenderContext {
  const authn = config.stack.http === 'none' ? 'off' : config.stack.authn;
  const tokens = authn === 'jwt' || authn === 'keycloak' || authn === 'passport';

  return {
    ...one(authn, ['jwt', 'keycloak', 'passport', 'none']),
    tokens,
    // Tokens verified against the issuer, its audience and its key set, by the kit or by a strategy of Passport.
    jwks: authn === 'jwt' || authn === 'passport',
    scheme: tokens ? 'bearer' : 'developmentActor',
  };
}
