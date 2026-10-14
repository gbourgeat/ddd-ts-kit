import type { Name } from '../../naming/index.js';
import type { RenderContext } from '../../templating/index.js';
import { accessVars } from '../access-vars.js';
import { named } from '../named.js';
import type { Scope } from '../scope.js';
import { specVars } from '../spec-vars.js';
import { vars } from '../vars.js';

/**
 * What the templates of a command read. `asksPolicy`: a policy refines its permission, so the
 * handler receives `Access` and asks it, about the command until the element is loaded.
 */
export function commandContext(
  scope: Scope,
  { name, aggregate }: { name: Name; aggregate: Name | undefined },
  asksPolicy: boolean,
): RenderContext {
  const reference = `${scope.context.camel}Permissions['${scope.flags.permission ?? ''}']`;
  const access = { ...accessVars(scope, { name, kind: 'Command' }), policy: asksPolicy, reference };

  return {
    ...vars(scope, { name: named(name), access, spec: specVars(scope, access) }),
    command: { hasAggregate: aggregate !== undefined, result: aggregate === undefined ? 'void' : 'string' },
    ...(aggregate === undefined ? {} : { aggregate: named(aggregate) }),
  };
}
