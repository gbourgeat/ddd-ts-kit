import type { Name } from '../../naming';
import type { RenderContext } from '../../templating';
import { accessVars } from '../access-vars';
import { named } from '../named';
import type { Scope } from '../scope';
import { searchedElements } from '../searched-elements';
import { specVars } from '../spec-vars';
import { vars } from '../vars';
import { readerFile } from './reader-file';
import type { UseCaseContext } from './use-case-context';
import { worldArrangement } from './world/world-arrangement';

/**
 * What the templates of a query read. `asksPolicy`: a policy refines its permission, so the
 * handler receives `Access` and asks it, about the query until the element is read. `search`:
 * one page of a search, whose reader answers lines.
 */
export function queryContext(
  scope: Scope,
  name: Name,
  { asksPolicy, search = false }: { asksPolicy: boolean; search?: boolean },
): UseCaseContext {
  const reference = `${scope.context.camel}Permissions['${scope.flags.permission ?? ''}']`;
  const required = accessVars(scope, { name, kind: 'Query' });
  const access = { ...required, policy: asksPolicy, reference };
  const spec = specVars(scope, access);

  // The reader answers what the spec gives it: the world cannot build its fake.
  const world = worldArrangement(scope, spec, {
    permission: required['protected'] === true ? 'holders' : undefined,
    fake: `fake(${name.pascal}Reader, new Fake${name.pascal}Reader(${search ? 'lines' : 'answer'}))`,
  });

  const context = vars(scope, {
    name: named(name),
    access,
    spec,
    world: world.vars,
    search: { resource: searchedResource(access), ...searchedElements(name) },
    reader: { file: readerFile(scope, name) },
  });

  return { vars: context, worldHint: world.hint };
}

/** The element a search answers, as the authorization model names it: the aggregate of its permission, to start with. */
function searchedResource(access: RenderContext): string {
  const permission = access['permission'];

  return typeof permission === 'string' ? (permission.split('.')[0] ?? '') : '';
}
