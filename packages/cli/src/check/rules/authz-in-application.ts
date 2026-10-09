import type { Layer, Rule, SourceFile } from '../types.js';
import { inLayer, reporter, toViolations, type Finding } from './helpers.js';

type ImportedModule = SourceFile['imports'][number];

interface Shortcut {
  readonly pattern: RegExp;
  readonly what: string;
}

/** What one layer must not do about rights, and what to do instead. */
interface LayerDuty {
  readonly layer: Layer;
  readonly code: readonly Shortcut[];
  /** What is wrong with an import, if anything. */
  imported(module: ImportedModule): string | undefined;
  readonly fix: string;
}

const AUTH_PACKAGE = '@ddd-ts-kit/auth';
const AUTHORIZERS = ['RoleBasedAuthorizer', 'PolicyBasedAuthorizer', 'RelationBasedAuthorizer', 'Authorizer', 'Access'];
const ACTOR_NAMES = ['Actor', 'ActorContext', 'AuthorizedCommand', 'AuthorizedQuery', 'anonymousActor', 'systemActor'];
const IS_ADMIN: Shortcut = { pattern: /(?<![\w$])isAdmin(?![\w$])/, what: 'isAdmin' };

const DUTIES: readonly LayerDuty[] = [
  {
    layer: 'presentation',
    code: [
      { pattern: /(?<![\w$])roles\s*\.\s*(?:includes|some|every|find|indexOf)\s*\(/, what: 'A test on the roles of the caller' },
      { pattern: /(?<![\w$])role\s*[!=]==?|[!=]==?\s*(?:[\w$]+\s*\.\s*)*role(?![\w$(])/, what: 'A comparison on a role' },
      IS_ADMIN,
    ],
    imported: ({ target, names }) => {
      const authorizer = target.kind === 'package' && target.name === AUTH_PACKAGE ? names.find((name) => AUTHORIZERS.includes(name)) : undefined;
      return authorizer === undefined ? undefined : `${authorizer} is imported`;
    },
    fix: 'Let the route only build the command or query with actorOf(context.principal): the permission is declared on the use case (.requires(...)) and decided by the bus middleware, and a rule on the loaded element is a policy in application/authorization/.',
  },
  {
    layer: 'infrastructure',
    code: [
      { pattern: /(?<![\w$])[\w$]*(?:[aA]uthorizer|[aA]ccess)\s*\.\s*(?:authorize|check)\s*\(/, what: 'An authorization check' },
      { pattern: /(?<![\w$])ForbiddenError(?![\w$])/, what: 'ForbiddenError' },
    ],
    imported: () => undefined,
    fix: 'Decide in the application layer (the bus middleware, or Access.authorize in the handler) and hand the adapter the AccessScope it has to apply: an adapter filters by that scope and by the tenant of ActorContext, it never refuses.',
  },
  {
    layer: 'domain',
    code: [{ pattern: /(?<![\w$])[\w$]*(?:[aA]ctor|[uU]ser|[pP]rincipal|[cC]aller|[rR]equester)\s*\.\s*(?:roles|permissions)(?![\w$])/, what: 'A test on the rights of the actor' }, IS_ADMIN],
    imported: ({ target, names }) => {
      if (target.kind !== 'package') return undefined;
      if (target.name === AUTH_PACKAGE) return `"${AUTH_PACKAGE}" is imported`;
      const actor = target.name === '@ddd-ts-kit/kernel' ? names.find((name) => ACTOR_NAMES.includes(name)) : undefined;
      return actor === undefined ? undefined : `${actor} is imported`;
    },
    fix: 'Keep invariants in the domain and move the right to application/authorization/: a permission checked by the bus middleware, or a policy evaluated through Access.authorize in the handler, which then calls the aggregate.',
  },
];

export const authzInApplication: Rule = {
  id: 'authz/in-application',
  description: 'The permission is decided in the application layer: no role test in presentation/, no authorization in infrastructure/, no knowledge of the actor in domain/.',
  scope: 'file',
  run(project) {
    const report = reporter(project, this.id);
    return project.files.flatMap((file) => toViolations(report, file.path, DUTIES.flatMap((duty) => breaches(file, duty))));
  },
};

function breaches(file: SourceFile, duty: LayerDuty): Finding[] {
  if (inLayer(file, duty.layer) === undefined) return [];
  const { code } = file.scan;
  const inCode = duty.code.flatMap(({ pattern, what }) => {
    const match = pattern.exec(code);
    return match === null ? [] : [{ line: file.scan.lineAt(match.index), what: `${what} is used` }];
  });
  const inImports = file.imports.flatMap((module) => {
    const what = duty.imported(module);
    return what === undefined ? [] : [{ line: module.line, what }];
  });
  return [...inCode, ...inImports].map(({ line, what }) => ({ line, message: `${what} in ${duty.layer}/: rights are decided in the application layer.`, fix: duty.fix }));
}
