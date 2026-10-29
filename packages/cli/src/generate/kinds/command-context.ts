import type { Name } from '../../naming';
import type { RenderContext } from '../../templating';
import { accessVars } from '../access-vars';
import { named } from '../named';
import type { Scope } from '../scope';
import { specVars } from '../spec-vars';
import { vars } from '../vars';
import { worldArrangement, type WorldNeeds } from './world/world-arrangement';

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
): RenderContext {
  const births = aggregate !== undefined && creates;
  const reference = `${scope.context.camel}Permissions['${scope.flags.permission ?? ''}']`;
  const required = accessVars(scope, { name, kind: 'Command' });
  const access = { ...required, policy: asksPolicy, reference };
  const spec = specVars(scope, access);

  const world = worldArrangement(
    scope,
    spec,
    worldNeeds(scope, { aggregate, births, isProtected: required['protected'] === true }),
  );

  return {
    ...vars(scope, { name: named(name), access, spec, world }),
    command: {
      hasAggregate: aggregate !== undefined,
      births,
      changes: aggregate !== undefined && !births,
      result: births ? 'string' : 'void',
    },
    ...(aggregate === undefined ? {} : { aggregate: named(aggregate) }),
  };
}

/**
 * What the spec of a command takes from the world: the fake of the repository of its aggregate;
 * and hands it: the permission under a container (the buses guard it in the spec), the prefix
 * of the identifier it gives birth to.
 */
function worldNeeds(
  scope: Scope,
  { aggregate, births, isProtected }: { aggregate: Name | undefined; births: boolean; isProtected: boolean },
): WorldNeeds {
  const guarded = isProtected && scope.config.stack.di === 'tsyringe';

  return {
    fakes: aggregate === undefined ? [] : [`${aggregate.camel}Repository`],
    options: [
      ...(guarded ? [['modules', '[holders]'] as const] : []),
      ...(births && aggregate !== undefined ? [['idPrefix', `'${aggregate.kebab}'`] as const] : []),
    ],
  };
}
