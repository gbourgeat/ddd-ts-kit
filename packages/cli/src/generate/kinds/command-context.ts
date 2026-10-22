import type { Name } from '../../naming';
import type { RenderContext } from '../../templating';
import { accessVars } from '../access-vars';
import { named } from '../named';
import type { Scope } from '../scope';
import { specVars } from '../spec-vars';
import { vars } from '../vars';

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
