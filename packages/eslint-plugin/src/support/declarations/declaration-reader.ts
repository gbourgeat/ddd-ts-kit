import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import type { ClassNode } from '../classes/class-name.js';
import { propertyName } from '../globals/property-name.js';
import { DECLARED_ROLES } from './declared-roles.js';

/** The entry of the kernel that holds the declaration decorators. */
export const DECLARATIONS_ENTRY = '@ddd-ts-kit/kernel/declarations';

/** The entry the decorators of the edge come from: a controller, a guard, a request mapper, a serializer. */
const EDGE_ENTRY = '@ddd-ts-kit/http';

const DECLARATION_DECORATORS: ReadonlySet<string> = new Set(DECLARED_ROLES.flatMap((role) => role.decorators));

/** A declaration decorator a class carries, under the name the kernel exports it with. */
export interface Declaration {
  readonly name: string;
  readonly node: TSESTree.Decorator;
  /** Empty for a decorator written without a call. */
  readonly arguments: readonly TSESTree.CallExpressionArgument[];
}

export type DeclarationReader = (node: ClassNode) => Declaration[];

/**
 * Reads the declarations of the classes of one program. A decorator counts when its name is
 * imported from the declarations entry of the kernel, or from `@ddd-ts-kit/http` for the edge, in that program: `{ Repository }`, an alias
 * `{ Repository as Repo }` or a namespace `declarations.Repository`.
 */
export function declarationReader(program: TSESTree.Program): DeclarationReader {
  const imports = program.body.filter(
    (statement) =>
      statement.type === AST_NODE_TYPES.ImportDeclaration &&
      (statement.source.value === DECLARATIONS_ENTRY || statement.source.value === EDGE_ENTRY),
  );

  const specifiers = imports.flatMap((statement) =>
    statement.type === AST_NODE_TYPES.ImportDeclaration ? statement.specifiers : [],
  );

  const named = new Map(specifiers.flatMap(namedDeclaration));

  const namespaces = new Set(
    specifiers
      .filter((specifier) => specifier.type === AST_NODE_TYPES.ImportNamespaceSpecifier)
      .map((specifier) => specifier.local.name),
  );

  const nameOf = (callee: TSESTree.Expression): string | undefined => {
    if (callee.type === AST_NODE_TYPES.Identifier) {
      return named.get(callee.name);
    }

    if (
      callee.type !== AST_NODE_TYPES.MemberExpression ||
      callee.object.type !== AST_NODE_TYPES.Identifier ||
      !namespaces.has(callee.object.name)
    ) {
      return undefined;
    }

    const exported = propertyName(callee);

    return exported !== undefined && DECLARATION_DECORATORS.has(exported) ? exported : undefined;
  };

  return (node) => node.decorators.flatMap((decorator) => declarationOf(decorator, nameOf));
}

function namedDeclaration(specifier: TSESTree.ImportClause): [string, string][] {
  if (specifier.type !== AST_NODE_TYPES.ImportSpecifier) {
    return [];
  }

  const exported =
    specifier.imported.type === AST_NODE_TYPES.Identifier ? specifier.imported.name : specifier.imported.value;

  return DECLARATION_DECORATORS.has(exported) ? [[specifier.local.name, exported]] : [];
}

function declarationOf(
  decorator: TSESTree.Decorator,
  nameOf: (callee: TSESTree.Expression) => string | undefined,
): Declaration[] {
  const { expression } = decorator;
  const called = expression.type === AST_NODE_TYPES.CallExpression;
  const name = nameOf(called ? expression.callee : expression);

  return name === undefined ? [] : [{ name, node: decorator, arguments: called ? expression.arguments : [] }];
}
