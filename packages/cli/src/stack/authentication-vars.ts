import type { Config } from '../config/index.js';
import type { RenderContext } from '../templating/index.js';
import { one } from './one.js';

/** Authentication happens at the HTTP boundary: without one there is nobody to identify. */
export function authenticationVars(config: Config): RenderContext {
  const authn = config.stack.http === 'none' ? 'off' : config.stack.authn;
  const tokens = authn === 'jwt' || authn === 'keycloak';

  return { ...one(authn, ['jwt', 'keycloak', 'none']), tokens, scheme: tokens ? 'bearer' : 'developmentActor' };
}
