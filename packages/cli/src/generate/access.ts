import { CliError } from '../errors.js';
import type { Name } from '../naming.js';
import type { RenderContext } from '../render.js';
import { renderTemplate } from '../templates.js';
import { applyWiring } from './emit.js';
import { concept } from './language.js';
import { vars, type Scope } from './scope.js';

/** A use case as the authorization sees it: its message class and whether it is a command or a query. */
export interface UseCaseMessage {
  readonly name: Name;
  readonly kind: 'Command' | 'Query';
}

const PERMISSION_NAME = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/;

/**
 * What `--permission` or `--public` says about a use case, as template variables. Deny by
 * default: a use case that declares neither is not generated. A new permission joins the
 * permissions of the context.
 */
export function accessVars(scope: Scope, useCase: UseCaseMessage): RenderContext {
  const permission = requestedPermission(scope, useCase);
  if (permission === undefined) return publicAccess(useCase);
  declarePermission(scope, permission, useCase.name);
  return protectedAccess(scope, useCase, permission);
}

function requestedPermission(scope: Scope, useCase: UseCaseMessage): string | undefined {
  const { permission, public: isPublic } = scope.flags;
  if (permission !== undefined && isPublic) {
    throw new CliError('--permission and --public exclude each other.', 'Keep --permission for a use case with a right to hold, or --public for one anybody may reach.');
  }
  if (permission === undefined && !isPublic) throw undeclared(scope, useCase);
  if (permission === undefined) return undefined;
  return permissionNamed(scope, permission);
}

/** A permission is named in the ubiquitous language, like everything else: `<aggregate>.<action>`. */
export function permissionNamed(scope: Scope, permission: string): string {
  if (!PERMISSION_NAME.test(permission)) {
    throw new CliError(`"${permission}" is not a permission name.`, 'Write it as <aggregate>.<action> in kebab-case, for example --permission invoice.issue.');
  }
  concept(scope, permission.replaceAll('.', ' '), { what: 'permission' });
  return permission;
}

function undeclared(scope: Scope, useCase: UseCaseMessage): CliError {
  const sample = `ddd-ts-kit generate ${useCase.kind.toLowerCase()} ${scope.context.kebab} ${useCase.name.pascal}`;
  return new CliError(
    `${useCase.name.pascal} declares neither a permission nor that it is public.`,
    `Nothing is reachable by default (rule authz/declared): run \`${sample} --permission <aggregate>.<action>\`, or \`${sample} --public\` when anybody may call it.`,
  );
}

function publicAccess(useCase: UseCaseMessage): RenderContext {
  const message = `${useCase.name.pascal}${useCase.kind}`;
  return {
    protected: false,
    public: true,
    permission: '',
    declaration: '.public()',
    manualImport: "import { publicUseCase } from '@ddd-ts-kit/auth';",
    manualDeclaration: `publicUseCase(${message}),`,
    permissionsImport: '',
    holder: '',
    queryBase: 'Query',
    constructorSample: 'constructor(readonly customerId: string) { super(); }',
  };
}

/** The file holding the permissions of a context, relative to the context. */
export const permissionsFile = (context: Name): string => `application/authorization/${context.kebab}.permissions.ts`;

export function declarePermission(scope: Scope, permission: string, useCase: Name): void {
  const file = `${scope.dir}/${permissionsFile(scope.context)}`;
  const context = vars(scope, { access: { permission, description: useCase.title } });
  if (!scope.ws.exists(file)) scope.ws.create(file, renderTemplate('context/permissions.ts.tpl', context));
  if ((scope.ws.read(file) ?? '').includes(`'${permission}':`)) return;
  applyWiring(scope.ws, file, renderTemplate('context/permission.tpl', context));
}

function protectedAccess(scope: Scope, useCase: UseCaseMessage, permission: string): RenderContext {
  const set = `${scope.context.camel}Permissions`;
  const message = `${useCase.name.pascal}${useCase.kind}`;
  const requirement = `${set}['${permission}']${resourceOption(scope)}`;
  return {
    protected: true,
    public: false,
    permission,
    declaration: `.requires(${requirement})`,
    manualImport: "import { requires } from '@ddd-ts-kit/auth';",
    manualDeclaration: `requires(${message}, ${requirement}),`,
    permissionsImport: `import { ${set} } from './${permissionsFile(scope.context).replace(/\.ts$/, '.js')}';`,
    holder: 'holder',
    queryBase: 'AuthorizedQuery',
    constructorSample: 'constructor(actor: Actor, readonly customerId: string) { super(actor); }',
  };
}

/** A relationship is always to something: until the elements are modelled, a use case names its context. */
function resourceOption(scope: Scope): string {
  if (scope.config.stack.authz !== 'rebac') return '';
  return `, { resource: () => ({ type: 'context', id: '${scope.context.kebab}' }) }`;
}

/** What a handler spec imports from the module file and lists as modules, with or without the guard. */
export function specVars(scope: Scope, access: RenderContext, tokens: readonly string[]): RenderContext {
  const isProtected = access['protected'] === true;
  const names = [...tokens, `${scope.context.camel}Module`, ...(isProtected ? [`${scope.context.camel}Permissions`] : [])];
  return {
    moduleNames: names.join(', '),
    modules: ['platformTestModule', `${scope.context.camel}Module`, ...(isProtected ? ['holders'] : [])].join(', '),
    guard: isProtected ? '.use(holders)' : '',
  };
}
