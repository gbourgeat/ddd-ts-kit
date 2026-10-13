import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import type { FunctionNode } from '../functions/function-node.js';
import { localBinding } from './local-binding.js';

/** A function or a constant a module exports, with the node it is reported on. */
export type ExportedBinding =
  | { readonly kind: 'function'; readonly name: string; readonly at: TSESTree.Node; readonly node: FunctionNode }
  | {
      readonly kind: 'object';
      readonly name: string;
      readonly at: TSESTree.Node;
      readonly node: TSESTree.ObjectExpression;
    };

/**
 * The functions (declared, or arrows and function expressions bound to a constant) and object
 * literals a module exports: inline, by `export { name }` and by `export default`, a name
 * exported after its declaration being read from that declaration.
 */
export function exportedBindings(program: TSESTree.Program): ExportedBinding[] {
  return program.body.flatMap((statement): ExportedBinding[] => {
    if (statement.type === AST_NODE_TYPES.ExportDefaultDeclaration) {
      return defaultExport(program, statement.declaration);
    }

    return statement.type === AST_NODE_TYPES.ExportNamedDeclaration && statement.exportKind !== 'type'
      ? namedExport(program, statement)
      : [];
  });
}

/** `export function ..`, `export const ..`, and the names of `export { .. }` without a source. */
function namedExport(program: TSESTree.Program, statement: TSESTree.ExportNamedDeclaration): ExportedBinding[] {
  const { declaration } = statement;

  if (declaration === null) {
    return statement.source === null ? statement.specifiers.flatMap((specifier) => listed(program, specifier)) : [];
  }

  if (declaration.type === AST_NODE_TYPES.FunctionDeclaration) {
    return bound(declaration, declaration.id?.name ?? 'default', declaration.id ?? declaration);
  }

  return declaration.type === AST_NODE_TYPES.VariableDeclaration ? declaration.declarations.flatMap(boundTo) : [];
}

/** `export { money }`, `export { money as of }`: what the local declaration binds, reported on the export. */
function listed(program: TSESTree.Program, specifier: TSESTree.ExportSpecifier): ExportedBinding[] {
  const { local, exported } = specifier;

  if (specifier.exportKind === 'type' || local.type !== AST_NODE_TYPES.Identifier) {
    return [];
  }

  const name = exported.type === AST_NODE_TYPES.Identifier ? exported.name : exported.value;

  return bound(localBinding(program, local.name), name, specifier);
}

/** `export default (..) => ..`, `export default function (..) {}`, `export default { .. }`, `export default money`. */
function defaultExport(program: TSESTree.Program, declaration: TSESTree.Node): ExportedBinding[] {
  if (declaration.type === AST_NODE_TYPES.FunctionDeclaration) {
    return [{ kind: 'function', name: 'default', at: declaration.id ?? declaration, node: declaration }];
  }

  return declaration.type === AST_NODE_TYPES.Identifier
    ? bound(localBinding(program, declaration.name), 'default', declaration)
    : bound(declaration, 'default', declaration);
}

function boundTo(declarator: TSESTree.VariableDeclarator): ExportedBinding[] {
  const name = declarator.id.type === AST_NODE_TYPES.Identifier ? declarator.id.name : 'a binding';

  return bound(declarator.init ?? undefined, name, declarator.id);
}

/** What a binding holds when it is a function or an object literal; nothing else is judged. */
function bound(value: TSESTree.Node | undefined, name: string, at: TSESTree.Node): ExportedBinding[] {
  const inner = value === undefined ? undefined : peeled(value);

  switch (inner?.type) {
    case AST_NODE_TYPES.FunctionDeclaration:
    case AST_NODE_TYPES.ArrowFunctionExpression:
    case AST_NODE_TYPES.FunctionExpression: {
      return [{ kind: 'function', name, at, node: inner }];
    }
    case AST_NODE_TYPES.ObjectExpression: {
      return [{ kind: 'object', name, at, node: inner }];
    }
    default: {
      return [];
    }
  }
}

/** The node under `as ..`, `satisfies ..` and `!`. */
function peeled(node: TSESTree.Node): TSESTree.Node {
  return node.type === AST_NODE_TYPES.TSAsExpression ||
    node.type === AST_NODE_TYPES.TSSatisfiesExpression ||
    node.type === AST_NODE_TYPES.TSNonNullExpression
    ? peeled(node.expression)
    : node;
}
