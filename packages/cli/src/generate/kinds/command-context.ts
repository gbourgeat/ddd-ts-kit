import type { Name } from '../../naming';
import { accessVars } from '../access-vars';
import { named } from '../named';
import type { Scope } from '../scope';
import { specVars } from '../spec-vars';
import { vars } from '../vars';
import { worldArrangement } from './world/world-arrangement';
import type { UseCaseContext } from './use-case-context';

/**
 * What the templates of a command read. `asksPolicy`: a policy refines its permission, so the
 * handler receives `Access` and asks it, about the command until the element is loaded. `births`:
 * `--creates` states that the command gives birth to its aggregate; otherwise a command on an aggregate
 * changes one that exists, and its handler writes nothing until the domain is decided.
 */
export function commandContext(
  scope: Scope,
  { name, aggregate, creates }: { name: Name; aggregate: Name | undefined; creates: boolean },
  asksPolicy: boolean,
): UseCaseContext {
  const births = aggregate !== undefined && creates;
  const reference = `${scope.context.camel}Permissions['${scope.flags.permission ?? ''}']`;
  const required = accessVars(scope, { name, kind: 'Command' });
  const access = { ...required, policy: asksPolicy, reference };
  const spec = specVars(scope, access);

  const world = worldArrangement(scope, spec, {
    repository: aggregate,
    idPrefix: births ? aggregate.kebab : undefined,
    permission: required['protected'] === true ? 'holders' : undefined,
  });

  const context = {
    ...vars(scope, { name: named(name), access, spec, world: world.vars }),
    command: {
      hasAggregate: aggregate !== undefined,
      births,
      changes: aggregate !== undefined && !births,
      result: births ? 'string' : 'void',
    },
    ...(aggregate === undefined ? {} : { aggregate: named(aggregate) }),
  };

  return { vars: context, worldHint: world.hint };
}
