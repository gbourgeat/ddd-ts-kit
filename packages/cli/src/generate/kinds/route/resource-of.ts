import type { Scope } from '../../scope.js';
import type { Endpoint } from './endpoint.js';

/** The first literal segment of the path names the resource; a path that starts with a parameter belongs to the context. */
export function resourceOf(scope: Scope, endpoint: Endpoint): string {
  const [first = ''] = endpoint.path.split('/').filter((segment) => segment !== '');

  return first === '' || first.startsWith(':') ? scope.context.kebab : first.replaceAll(/[._~]/g, '-');
}
