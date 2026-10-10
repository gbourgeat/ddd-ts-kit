import { DECLARATIONS_ENTRY } from '../declarations/declarations-entry.js';
import type { Finding } from '../model/finding.js';
import type { Layer } from '../model/layer.js';
import type { ResolvedImport } from '../model/resolved-import.js';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import { inLayer } from '../support/in-layer.js';
import { perFile } from '../support/per-file.js';

interface Shortcut {
  readonly pattern: RegExp;
  readonly what: string;
}

/** What one layer must not do about rights, and what to do instead. */
interface LayerDuty {
  readonly layer: Layer;
  readonly code: readonly Shortcut[];
  /** What is wrong with an import, if anything. */
  imported(module: ResolvedImport): string | undefined;
  readonly fix: string;
}

const AUTH_PACKAGE = '@ddd-ts-kit/auth';
/** What declares a right in application/: the two access decorators and the policy decorator. */
const ACCESS_DECLARATIONS = ['Requires', 'Public', 'Policy'];
/** The ports through which the application layer decides a right. */
const ACCESS_PORTS = ['Access', 'PolicyAccess'];
const AUTHORIZERS = ['RoleBasedAuthorizer', 'PolicyBasedAuthorizer', 'RelationBasedAuthorizer', 'Authorizer'];

const ACTOR_NAMES = [
  'Actor',
  'ActorContext',
  'Session',
  'ExecutionContext',
  'AuthorizedCommand',
  'AuthorizedQuery',
  'anonymousActor',
  'systemActor',
];

const IS_ADMIN: Shortcut = { pattern: /(?<![\w$])isAdmin(?![\w$])/, what: 'isAdmin' };

const DUTIES: readonly LayerDuty[] = [
  {
    layer: 'presentation',
    code: [
      {
        pattern: /(?<![\w$])roles\s*\.\s*(?:includes|some|every|find|indexOf)\s*\(/,
        what: 'A test on the roles of the caller',
      },
      {
        pattern: /(?<![\w$])role\s*[!=]==?|[!=]==?\s*(?:[\w$]+\s*\.\s*)*role(?![\w$(])/,
        what: 'A comparison on a role',
      },
      IS_ADMIN,
    ],
    imported: (module) => importedFromAuth(module, AUTHORIZERS) ?? accessDeclaration(module),
    fix: 'Let the route only build the command or query with actorOf(context.principal) (sessionOf, resolveSession and a SessionAuthenticator are request glue too): the permission is declared on the use case (.requires(...) in a module file, @Requires on the message class) and decided by the bus middleware, and a rule on the loaded element is a policy in application/authorization/.',
  },
  {
    layer: 'infrastructure',
    code: [
      {
        pattern: /(?<![\w$])[\w$]*(?:[aA]uthorizer|[aA]ccess)\s*\.\s*(?:authorize|check)\s*\(/,
        what: 'An authorization check',
      },
      { pattern: /(?<![\w$])ForbiddenError(?![\w$])/, what: 'ForbiddenError' },
    ],
    imported: accessDeclaration,
    fix: 'Decide in the application layer (the bus middleware, or the Access port in the handler) and hand the adapter the AccessScope it has to apply: an adapter filters by that scope and by the tenant of the execution scope, it never refuses.',
  },
  {
    layer: 'domain',
    code: [
      {
        pattern:
          /(?<![\w$])[\w$]*(?:[aA]ctor|[uU]ser|[pP]rincipal|[cC]aller|[rR]equester)\s*\.\s*(?:roles|permissions)(?![\w$])/,
        what: 'A test on the rights of the actor',
      },
      IS_ADMIN,
    ],
    imported: ({ target, names }) => {
      if (target.kind !== 'package') {
        return undefined;
      }

      if (target.name === AUTH_PACKAGE) {
        return `"${AUTH_PACKAGE}" is imported`;
      }

      const actor = target.name === '@ddd-ts-kit/kernel' ? names.find((name) => ACTOR_NAMES.includes(name)) : undefined;

      return actor === undefined ? undefined : `${actor} is imported`;
    },
    fix: 'Keep invariants in the domain and move the right to application/authorization/: a permission checked by the bus middleware, or a policy evaluated through the Access port in the handler, which then calls the aggregate.',
  },
];

export const authzInApplication: Rule = {
  id: 'authz/in-application',
  description:
    'The permission is decided in the application layer: no role test in presentation/, no authorization in infrastructure/, no knowledge of the actor in domain/.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) => DUTIES.flatMap((duty) => breaches(file, duty)));
  },
};

function importedFromAuth({ target, names }: ResolvedImport, refused: readonly string[]): string | undefined {
  const name =
    target.kind === 'package' && target.name === AUTH_PACKAGE
      ? names.find((candidate) => refused.includes(candidate))
      : undefined;

  return name === undefined ? undefined : `${name} is imported`;
}

/** `Requires`, `Public` and `Policy` of the kernel declarations and the access ports of the auth package belong to application/ alone. */
function accessDeclaration(module: ResolvedImport): string | undefined {
  const declared =
    module.specifier === DECLARATIONS_ENTRY
      ? module.names.find((name) => ACCESS_DECLARATIONS.includes(name))
      : undefined;

  return declared === undefined ? importedFromAuth(module, ACCESS_PORTS) : `${declared} is imported`;
}

function breaches(file: SourceFile, duty: LayerDuty): Finding[] {
  if (inLayer(file, duty.layer) === undefined) {
    return [];
  }

  const { code } = file.scan;

  const inCode = duty.code.flatMap(({ pattern, what }) => {
    const match = pattern.exec(code);

    return match === null ? [] : [{ line: file.scan.lineAt(match.index), what: `${what} is used` }];
  });

  const inImports = file.imports.flatMap((module) => {
    const what = duty.imported(module);

    return what === undefined ? [] : [{ line: module.line, what }];
  });

  return [...inCode, ...inImports].map(({ line, what }) => ({
    line,
    message: `${what} in ${duty.layer}/: rights are decided in the application layer.`,
    fix: duty.fix,
  }));
}
