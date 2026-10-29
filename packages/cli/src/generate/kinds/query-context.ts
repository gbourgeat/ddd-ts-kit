import type { Name } from '../../naming';
import type { RenderContext } from '../../templating';
import { accessVars } from '../access-vars';
import { named } from '../named';
import type { Scope } from '../scope';
import { searchedElements } from '../searched-elements';
import { specVars } from '../spec-vars';
import { vars } from '../vars';
import { readerFile } from './reader-file';
import { worldArrangement, type WorldNeeds } from './world/world-arrangement';

/**
 * What the templates of a query read. `asksPolicy`: a policy refines its permission, so the
 * handler receives `Access` and asks it, about the query until the element is read. `search`:
 * one page of a search, whose reader answers lines.
 */
export function queryContext(
  scope: Scope,
  name: Name,
  { asksPolicy, search = false }: { asksPolicy: boolean; search?: boolean },
): RenderContext {
  const reference = `${scope.context.camel}Permissions['${scope.flags.permission ?? ''}']`;
  const required = accessVars(scope, { name, kind: 'Query' });
  const access = { ...required, policy: asksPolicy, reference };
  const spec = specVars(scope, access);

  return vars(scope, {
    name: named(name),
    access,
    spec,
    world: worldArrangement(
      scope,
      spec,
      worldNeeds(scope, name, { search, isProtected: required['protected'] === true }),
    ),
    search: { resource: searchedResource(access), ...searchedElements(name) },
    reader: { file: readerFile(scope, name) },
  });
}

/** The element a search answers, as the authorization model names it: the aggregate of its permission, to start with. */
function searchedResource(access: RenderContext): string {
  const permission = access['permission'];

  return typeof permission === 'string' ? (permission.split('.')[0] ?? '') : '';
}

/**
 * What the spec of a query hands the world under a container: the permission, and the fake of its
 * reader, which answers what the spec gives it, so the world cannot build it. The buses take
 * neither: the spec builds the handler on the fake and guards the bus itself.
 */
function worldNeeds(
  scope: Scope,
  name: Name,
  { search, isProtected }: { search: boolean; isProtected: boolean },
): WorldNeeds {
  if (scope.config.stack.di !== 'tsyringe') {
    return {};
  }

  const answer = search ? 'lines' : 'answer';

  return {
    options: [
      ...(isProtected ? [['modules', '[holders]'] as const] : []),
      ['fakes', `[fake(${name.pascal}Reader, new Fake${name.pascal}Reader(${answer}))]`] as const,
    ],
  };
}
