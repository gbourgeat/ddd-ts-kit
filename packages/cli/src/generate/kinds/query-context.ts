import type { Name } from '../../naming';
import type { RenderContext } from '../../templating';
import { accessVars } from '../access-vars';
import { named } from '../named';
import type { Scope } from '../scope';
import { searchedElements } from '../searched-elements';
import { specVars } from '../spec-vars';
import { vars } from '../vars';
import { readerFile } from './reader-file';

/**
 * What the templates of a query read. `asksPolicy`: a policy refines its permission, so the
 * handler receives `Access` and asks it, about the query until the element is read.
 */
export function queryContext(scope: Scope, name: Name, asksPolicy: boolean): RenderContext {
  const reference = `${scope.context.camel}Permissions['${scope.flags.permission ?? ''}']`;
  const access = { ...accessVars(scope, { name, kind: 'Query' }), policy: asksPolicy, reference };

  return vars(scope, {
    name: named(name),
    access,
    spec: specVars(scope, access),
    search: { resource: searchedResource(access), ...searchedElements(name) },
    reader: { file: readerFile(scope, name) },
  });
}

/** The element a search answers, as the authorization model names it: the aggregate of its permission, to start with. */
function searchedResource(access: RenderContext): string {
  const permission = access['permission'];

  return typeof permission === 'string' ? (permission.split('.')[0] ?? '') : '';
}
