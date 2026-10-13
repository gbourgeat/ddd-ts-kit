import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { isInlineExport } from '../classes/is-inline-export.js';
import type { FunctionNode } from '../functions/function-node.js';
import { unwrapped } from './unwrapped.js';

/** A function or a constant a module exports, with the node it is reported on. */
export type ExportedBinding =
  | { readonly kind: 'function'; readonly name: string; readonly at: TSESTree.Node; readonly node: FunctionNode }
  | {
      readonly kind: 'object';
      readonly name: string;
      readonly at: TSESTree.Node;
      readonly node: TSESTree.ObjectExpression;
    };

/** The functions (declared, or arrows and function expressions bound to a constant) and object literals a module exports inline. */
export function exportedBindings(program: TSESTree.Program): ExportedBinding[] {
  return program.body.flatMap((statement) => {
    const declaration = isInlineExport(statement) ? statement.declaration : undefined;

    if (declaration?.type === AST_NODE_TYPES.FunctionDeclaration) {
      return [
        {
          kind: 'function',
          name: declaration.id?.name ?? 'default',
          at: declaration.id ?? declaration,
          node: declaration,
        },
      ];
    }

    return declaration?.type === AST_NODE_TYPES.VariableDeclaration ? declaration.declarations.flatMap(boundTo) : [];
  });
}

function boundTo(declarator: TSESTree.VariableDeclarator): ExportedBinding[] {
  const value = declarator.init === null ? undefined : unwrapped(declarator.init);
  const name = declarator.id.type === AST_NODE_TYPES.Identifier ? declarator.id.name : 'a binding';

  if (value?.type === AST_NODE_TYPES.ArrowFunctionExpression || value?.type === AST_NODE_TYPES.FunctionExpression) {
    return [{ kind: 'function', name, at: declarator.id, node: value }];
  }

  return value?.type === AST_NODE_TYPES.ObjectExpression
    ? [{ kind: 'object', name, at: declarator.id, node: value }]
    : [];
}
