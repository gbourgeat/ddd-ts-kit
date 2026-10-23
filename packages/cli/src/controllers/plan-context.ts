import { posix } from 'node:path';
import { intoModule, moduleSplit, roleFilesOf, treeOf, type ContextTree } from '../model-modules';
import { toName } from '../naming';
import { handleTypesOf, type HandleTypes } from './handle-types-of';
import type { FunctionRoute } from './function-route';
import { handleBody } from './handle-body';
import type { MigratedGroup } from './migrated-group';
import type { Migration } from './migration';
import { readFunctionRoute } from './read-function-route';

export interface PlannedController {
  readonly route: FunctionRoute;
  readonly types: HandleTypes;
  readonly body: string;
  /** The folder of its resource: the first literal segment of its path, or the context. */
  readonly resource: string;
  readonly isPublic: boolean;
  /** The `presentation/http` folder its route sits in: the context's, or that of a module of its model. */
  readonly http: string;
  /** The folder of the unit specs of that module, or of the context. */
  readonly unit: string;
}

export interface ContextPlan {
  readonly context: string;
  /** `<contextsDir>/<context>/presentation/http`, where the route groups are written. */
  readonly http: string;
  readonly controllers: readonly PlannedController[];
  readonly groups: ReadonlyMap<string, MigratedGroup>;
}

/** Reads every function route of a context; one that cannot be turned blocks the whole context, said in `blockers`. */
export function planContext(migration: Migration, context: string): ContextPlan | undefined {
  const { ws, config, blockers } = migration;
  const tree = treeOf(config, context);
  const http = `${tree.directory}/presentation/http`;

  // The function routes of the context and those of each module of its model.
  const files = roleFilesOf(ws, tree, 'presentation/http').filter(({ name }) => name.endsWith('.route.ts'));
  const planned = files.map(({ path }) => plannedOf(path, ws.read(path) ?? '', { context, tree }));
  const refused = planned.filter((entry) => typeof entry === 'string');

  if (files.length === 0 || refused.length > 0) {
    blockers.push(...refused);

    return undefined;
  }

  const controllers = planned.filter((entry) => typeof entry !== 'string');

  return { context, http, controllers, groups: groupsOf(controllers, context) };
}

/** The context a route is planned in, with its directory and the modules of its model. */
interface Planning {
  readonly context: string;
  readonly tree: ContextTree;
}

function plannedOf(file: string, source: string, { context, tree }: Planning): PlannedController | string {
  const route = readFunctionRoute(file, source);

  if (typeof route === 'string') {
    return `${file}: ${route}.`;
  }

  const types = handleTypesOf(route);
  const body = handleBody(route);

  if (typeof types === 'string') {
    return `${file}: ${types}.`;
  }

  if (body === undefined) {
    return `${file}: its handler answers something else than \`{ status, body }\` (headers, a status chosen at run time): keep it a function.`;
  }

  const http = posix.dirname(file);
  const { module } = moduleSplit(file.slice(tree.directory.length + 1), tree.modules);

  return {
    route,
    types,
    body,
    resource: resourceOf(route, context),
    isPublic: route.spec.get('security') === 'false',
    http,
    unit: `${tree.directory}/${intoModule(module, 'test/unit')}`,
  };
}

/** The first literal segment of the path names the resource; a path that starts with a parameter belongs to the context. */
function resourceOf(route: FunctionRoute, context: string): string {
  const [first = ''] = unquoted(route.spec.get('path') ?? '')
    .split('/')
    .filter((segment) => segment !== '');

  return first === '' || first.startsWith(':') ? context : first.replaceAll(/[._~]/g, '-');
}

function groupsOf(controllers: readonly PlannedController[], context: string): Map<string, MigratedGroup> {
  const groups = new Map<string, MigratedGroup>();

  for (const { resource, route } of controllers.filter((controller) => !controller.isPublic)) {
    const members = controllers.filter((other) => other.resource === resource && !other.isPublic);

    groups.set(resource, {
      kebab: resource,
      className: `${toName(resource).pascal}Routes`,
      prefix: resource === context && !pathStartsWith(route, resource) ? '' : `/${resource}`,
      tags: groups.get(resource)?.tags ?? listed(route.spec.get('tags')).map(unquoted),
      errors: members.every((member) => (member.route.spec.get('errors') ?? '').includes("'FORBIDDEN'"))
        ? ['FORBIDDEN']
        : [],
    });
  }

  return groups;
}

function pathStartsWith(route: FunctionRoute, segment: string): boolean {
  return unquoted(route.spec.get('path') ?? '').startsWith(`/${segment}`);
}

function listed(list: string | undefined): string[] {
  return (list ?? '[]')
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
}

function unquoted(text: string): string {
  return text.replace(/^['"]|['"]$/g, '');
}
