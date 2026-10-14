import { escapeRegExp } from '../check/text/escape-reg-exp.js';
import type { Scope } from './scope.js';

/** How the code of the context names `permission`: `<context>Permissions['<permission>']`, either quote. */
export function permissionPattern(scope: Scope, permission: string): RegExp {
  const set = escapeRegExp(`${scope.context.camel}Permissions`);

  return new RegExp(`${set}\\s*\\[\\s*['"\`]${escapeRegExp(permission)}['"\`]\\s*\\]`);
}
