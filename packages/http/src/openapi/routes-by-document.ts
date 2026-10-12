import { DeclarationError } from '@ddd-ts-kit/kernel/declarations';
import type { Route } from '../route/route.js';
import type { DocumentRoutes } from './document-routes.js';
import type { OpenApiDocumentSelection } from './open-api-document-selection.js';

/** Without a selection, the one document every project had before the contract could be split. */
const WHOLE = 'openapi';

/**
 * Splits the routes between the documents of the contract. Each document holds the routes it
 * selects, a route may be in several on purpose, and a route in none is refused: nothing
 * leaves the contract silently. Without any selection there is one document, `openapi`.
 */
export function routesByDocument(
  routes: readonly Route[],
  selections: readonly OpenApiDocumentSelection[],
): DocumentRoutes[] {
  if (selections.length === 0) {
    return [{ name: WHOLE, routes }];
  }

  const unplaced = routes.filter((route) => !selections.some((selection) => selects(selection, route)));

  if (unplaced.length > 0) {
    throw new DeclarationError(
      `No document of "openapi.documents" holds ${unplaced.map(described).join(', ')}. Name its route group, its context or one of its tags in a document of ddd-ts-kit.config.json, then run \`ddd-ts-kit docs\`.`,
    );
  }

  return selections.map(({ name, title, ...selection }) => ({
    name,
    ...(title === undefined ? {} : { title }),
    routes: routes.filter((route) => selects(selection, route)),
  }));
}

function selects(selection: Omit<OpenApiDocumentSelection, 'name' | 'title'>, route: Route): boolean {
  return (
    (route.groups ?? []).some((group) => selection.groups?.includes(group) === true) ||
    (route.tags ?? []).some((tag) => selection.tags?.includes(tag) === true) ||
    selection.operations?.includes(route.operationId) === true
  );
}

function described(route: Route): string {
  return `${route.method} ${route.path} (${route.operationId})`;
}
