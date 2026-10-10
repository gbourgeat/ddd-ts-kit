import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import type { LintedFile } from '../project/linted-file.js';
import { hasSpread, propertyOf } from './calls.js';
import type { ClassNode } from './classes.js';
import { propertyName } from './globals.js';
import { staticString } from './imports.js';

/** The entry of the kernel that holds the declaration decorators and the tokens of the standard ports. */
export const DECLARATIONS_ENTRY = '@ddd-ts-kit/kernel/declarations';

export interface DeclaredRole {
  /** File suffix, without the extension: `handler` for `*.handler.ts`. */
  readonly suffix: string;
  /** Folders of the context, relative to it, the files of this suffix belong in. */
  readonly folders: readonly string[];
  /** The decorators one of which the exported class carries. */
  readonly decorators: readonly string[];
}

/** Same table as `DECLARED_ROLES` of the CLI, which this plugin does not depend on. */
const DECLARED_ROLES: readonly DeclaredRole[] = [
  { suffix: 'command', folders: ['application/commands'], decorators: ['Requires', 'Public'] },
  { suffix: 'query', folders: ['application/queries'], decorators: ['Requires', 'Public'] },
  { suffix: 'handler', folders: ['application/commands'], decorators: ['CommandHandler'] },
  { suffix: 'handler', folders: ['application/queries'], decorators: ['QueryHandler'] },
  { suffix: 'integration-handler', folders: ['application/integration/handlers'], decorators: ['IntegrationEventHandler'] },
  { suffix: 'event-handler', folders: ['application/event-handlers'], decorators: ['DomainEventHandler'] },
  { suffix: 'publisher', folders: ['application/integration/publishers'], decorators: ['DomainEventHandler'] },
  { suffix: 'policy', folders: ['application/authorization'], decorators: ['Policy'] },
  { suffix: 'repository', folders: ['infrastructure/persistence'], decorators: ['Repository'] },
  { suffix: 'gateway', folders: ['infrastructure'], decorators: ['Gateway'] },
  { suffix: 'adapter', folders: ['infrastructure'], decorators: ['Adapter'] },
];

const DECLARATION_DECORATORS: ReadonlySet<string> = new Set(DECLARED_ROLES.flatMap((role) => role.decorators));

/** The decorators that say who may send a message. */
export const ACCESS_DECORATORS: ReadonlySet<string> = new Set(['Requires', 'Public']);

/** A declaration decorator a class carries, under the name the kernel exports it with. */
export interface Declaration {
  readonly name: string;
  readonly node: TSESTree.Decorator;
  /** Empty for a decorator written without a call. */
  readonly arguments: readonly TSESTree.CallExpressionArgument[];
}

export type DeclarationReader = (node: ClassNode) => Declaration[];

/** Why a name is not written where a declaration needs it, in the words of a report. */
type NameProblem = 'missing' | 'empty' | 'not a string literal';

/** The options keys that hold a name written once and never derived: the idempotency scope, the policy name, the event name. */
export const WRITTEN_NAMES: Readonly<Record<string, string>> = { IntegrationEventHandler: 'consumer', DomainEventHandler: 'name', Policy: 'name' };

export function isDeclaredStyle(file: LintedFile): boolean {
  return file.config.stack.style === 'declared';
}

/** The role a production file of a context plays by its suffix and folder, whatever the style of the project. */
export function declaredRoleOf(file: LintedFile): DeclaredRole | undefined {
  const { location } = file;
  if (location.area !== 'context' || file.isTest || !/(?<!\.d)\.ts$/.test(file.path)) return undefined;
  const inContext = [location.layer, ...location.inside].join('/');
  const stem = inContext.slice(0, -'.ts'.length);
  return DECLARED_ROLES.find((role) => stem.endsWith(`.${role.suffix}`) && role.folders.some((folder) => inContext.startsWith(`${folder}/`)));
}

/** The name an options argument writes under `key`: a non-empty string literal, or what stands in its place. */
export function writtenName(options: TSESTree.Node | undefined, key: string): { readonly value: string } | { readonly problem: NameProblem } {
  if (options === undefined) return { problem: 'missing' };
  const property = options.type === AST_NODE_TYPES.ObjectExpression ? propertyOf(options, key) : undefined;
  if (property === undefined) return { problem: options.type === AST_NODE_TYPES.ObjectExpression && !hasSpread(options) ? 'missing' : 'not a string literal' };
  const value = staticString(property.value);
  if (value === undefined) return { problem: 'not a string literal' };
  return value === '' ? { problem: 'empty' } : { value };
}

/**
 * Reads the declarations of the classes of one program. A decorator counts when its name is
 * imported from the declarations entry of the kernel in that program: `{ Repository }`, an alias
 * `{ Repository as Repo }` or a namespace `declarations.Repository`.
 */
export function declarationReader(program: TSESTree.Program): DeclarationReader {
  const imports = program.body.filter((statement) => statement.type === AST_NODE_TYPES.ImportDeclaration && statement.source.value === DECLARATIONS_ENTRY);
  const specifiers = imports.flatMap((statement) => (statement.type === AST_NODE_TYPES.ImportDeclaration ? statement.specifiers : []));
  const named = new Map(specifiers.flatMap(namedDeclaration));
  const namespaces = new Set(specifiers.filter((specifier) => specifier.type === AST_NODE_TYPES.ImportNamespaceSpecifier).map((specifier) => specifier.local.name));
  const nameOf = (callee: TSESTree.Expression): string | undefined => {
    if (callee.type === AST_NODE_TYPES.Identifier) return named.get(callee.name);
    if (callee.type !== AST_NODE_TYPES.MemberExpression || callee.object.type !== AST_NODE_TYPES.Identifier || !namespaces.has(callee.object.name)) return undefined;
    const exported = propertyName(callee);
    return exported !== undefined && DECLARATION_DECORATORS.has(exported) ? exported : undefined;
  };
  return (node) => node.decorators.flatMap((decorator) => declarationOf(decorator, nameOf));
}

function namedDeclaration(specifier: TSESTree.ImportClause): [string, string][] {
  if (specifier.type !== AST_NODE_TYPES.ImportSpecifier) return [];
  const exported = specifier.imported.type === AST_NODE_TYPES.Identifier ? specifier.imported.name : specifier.imported.value;
  return DECLARATION_DECORATORS.has(exported) ? [[specifier.local.name, exported]] : [];
}

function declarationOf(decorator: TSESTree.Decorator, nameOf: (callee: TSESTree.Expression) => string | undefined): Declaration[] {
  const { expression } = decorator;
  const called = expression.type === AST_NODE_TYPES.CallExpression;
  const name = nameOf(called ? expression.callee : expression);
  return name === undefined ? [] : [{ name, node: decorator, arguments: called ? expression.arguments : [] }];
}
