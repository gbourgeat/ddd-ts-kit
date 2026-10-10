import { CliError } from '../cli-error.js';
import type { RenderContext } from '../templating/index.js';
import { declarePermission } from './declare-permission.js';
import { permissionNamed } from './permission-named.js';
import { permissionsFile } from './permissions-file.js';
import type { Scope } from './scope.js';
import type { UseCaseMessage } from './use-case-message.js';

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

  return permission === undefined ? undefined : permissionNamed(scope, permission);
}

function undeclared(scope: Scope, useCase: UseCaseMessage): CliError {
  const sample = `ddd-ts-kit generate ${useCase.kind.toLowerCase()} ${scope.context.kebab} ${useCase.name.pascal}`;

  return new CliError(
    `${useCase.name.pascal} declares neither a permission nor that it is public.`,
    `Nothing is reachable by default (rule authz/declared): run \`${sample} --permission <aggregate>.<action>\`, or \`${sample} --public\` when anybody may call it.`,
  );
}

function publicAccess(useCase: UseCaseMessage): RenderContext {
  return {
    protected: false,
    public: true,
    permission: '',
    declaration: '.public()',
    manualImport: "import { publicUseCase } from '@ddd-ts-kit/auth';",
    manualDeclaration: `publicUseCase(${useCase.name.pascal}${useCase.kind}),`,
    permissionsImport: '',
    holder: '',
    requirement: '',
    useCasePermissionsImport: '',
    decorator: 'Public',
    decoration: 'Public()',
    queryBase: 'Query',
    constructorSample: 'constructor(readonly customerId: string) { super(); }',
  };
}

function protectedAccess(scope: Scope, useCase: UseCaseMessage, permission: string): RenderContext {
  const set = `${scope.context.camel}Permissions`;
  const requirement = `${set}['${permission}']${resourceOption(scope)}`;

  return {
    protected: true,
    public: false,
    permission,
    declaration: `.requires(${requirement})`,
    manualImport: "import { requires } from '@ddd-ts-kit/auth';",
    manualDeclaration: `requires(${useCase.name.pascal}${useCase.kind}, ${requirement}),`,
    permissionsImport: `import { ${set} } from './${permissionsFile(scope.context).replace(/\.ts$/, '.js')}';`,
    holder: 'holder',
    requirement,
    useCasePermissionsImport: `import { ${set} } from '../../authorization/${scope.context.kebab}.permissions.js';`,
    decorator: 'Requires',
    decoration: `Requires(${requirement})`,
    queryBase: 'AuthorizedQuery',
    constructorSample: 'constructor(actor: Actor, readonly customerId: string) { super(actor); }',
  };
}

/** A relationship is always to something: until the elements are modelled, a use case names its context. */
function resourceOption(scope: Scope): string {
  if (scope.config.stack.authz !== 'rebac') return '';

  return `, { resource: () => ({ type: 'context', id: '${scope.context.kebab}' }) }`;
}
