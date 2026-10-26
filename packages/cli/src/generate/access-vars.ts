import { specifierOf } from '../alias';
import { CliError } from '../cli-error';
import { fitStatement } from '../layout';
import type { RenderContext } from '../templating';
import { declarePermission } from './declare-permission';
import { grantPermission } from './grant-permission';
import { permissionNamed } from './permission-named';
import { permissionsFile } from './permissions-file';
import type { Scope } from './scope';
import type { UseCaseMessage } from './use-case-message';

/**
 * What `--permission` or `--public` says about a use case, as template variables. Deny by
 * default: a use case that declares neither is not generated. A new permission joins the
 * permissions of the context.
 */
export function accessVars(scope: Scope, useCase: UseCaseMessage): RenderContext {
  const permission = requestedPermission(scope, useCase);

  if (permission === undefined) {
    return publicAccess(useCase);
  }

  declarePermission(scope, permission, useCase.name);
  grantPermission(scope, permission);

  return protectedAccess(scope, useCase, permission);
}

function requestedPermission(scope: Scope, useCase: UseCaseMessage): string | undefined {
  const { permission, public: isPublic } = scope.flags;

  if (permission !== undefined && isPublic) {
    throw new CliError(
      '--permission and --public exclude each other.',
      'Keep --permission for a use case with a right to hold, or --public for one anybody may reach.',
    );
  }

  if (scope.flags.grant !== undefined && isPublic) {
    throw new CliError(
      '--grant and --public exclude each other.',
      'A public use case needs no role to hold it: keep --public alone, or give --permission with --grant <role>.',
    );
  }

  if (permission === undefined && !isPublic) {
    throw undeclared(scope, useCase);
  }

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
    resourceTodo: '',
    resourceUnnamed: false,
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
  const file = `${scope.config.contextsDir}/${scope.context.kebab}/${permissionsFile(scope.context)}`;
  const permissions = `import { ${set} } from '${specifierOf(scope.config, file)}';`;
  const requirement = `${set}['${permission}']${resourceOption(scope)}`;

  return {
    protected: true,
    public: false,
    permission,
    declaration: `.requires(${requirement})`,
    manualImport: "import { requires } from '@ddd-ts-kit/auth';",
    manualDeclaration: `requires(${useCase.name.pascal}${useCase.kind}, ${requirement}),`,
    permissionsImport: permissions,
    resourceTodo: resourceTodo(scope, useCase, permission),
    resourceUnnamed: scope.config.stack.authz === 'rebac',
    holder: 'holder',
    requirement,
    useCasePermissionsImport: permissions,
    decorator: 'Requires',
    decoration: fitStatement(`@Requires(${requirement})`, '').join('\n').slice(1),
    queryBase: 'AuthorizedQuery',
    constructorSample: 'constructor(actor: Actor, readonly customerId: string) { super(actor); }',
  };
}

/** A relationship is always to something: until the elements are modelled, a use case names its context. */
function resourceOption(scope: Scope): string {
  if (scope.config.stack.authz !== 'rebac') {
    return '';
  }

  return `, { resource: () => ({ type: 'context', id: '${scope.context.kebab}' }) }`;
}

/**
 * Under relationships a protected use case names its context until the element is modelled, and the
 * schema derives no permission on the context that another type derives: the marker says which
 * element to decide, so that `todo` lists it.
 */
function resourceTodo(scope: Scope, useCase: UseCaseMessage, permission: string): string {
  if (scope.config.stack.authz !== 'rebac') {
    return '';
  }

  const element = permission.split('.')[0] ?? '';
  const camel = element.replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase());
  const message = useCase.kind.toLowerCase();

  return `TODO(domain): name the ${element} this ${message} is about, \`{ type: '${element}', id: ${message}.${camel}Id }\`, once its constructor declares it, and derive '${permission}' on that type in the relationship schema; the context is the resource of a use case on no element.`;
}
