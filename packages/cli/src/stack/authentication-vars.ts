import type { Config } from '../config';
import type { RenderContext } from '../templating';
import { one } from './one';

/** Authentication happens at the HTTP boundary: without one there is nobody to identify. */
export function authenticationVars(config: Config): RenderContext {
  const authn = config.stack.http === 'none' ? 'off' : config.stack.authn;
  const tokens = authn === 'jwt' || authn === 'keycloak';

  return { ...one(authn, ['jwt', 'keycloak', 'none']), tokens, scheme: tokens ? 'bearer' : 'developmentActor' };
}
