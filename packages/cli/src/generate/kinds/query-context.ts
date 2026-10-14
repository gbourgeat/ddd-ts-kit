import type { Name } from '../../naming/index.js';
import type { RenderContext } from '../../templating/index.js';
import { accessVars } from '../access-vars.js';
import { named } from '../named.js';
import type { Scope } from '../scope.js';
import { searchedElements } from '../searched-elements.js';
import { specVars } from '../spec-vars.js';
import { vars } from '../vars.js';
import { readerFile } from './reader-file.js';

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
