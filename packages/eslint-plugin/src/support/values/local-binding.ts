import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import type { FunctionNode } from '../functions/function-node.js';

/** What a name declared at the top of a module binds: its function, or the value of its constant. */
export function localBinding(program: TSESTree.Program, name: string): FunctionNode | TSESTree.Expression | undefined {
  for (const statement of program.body) {
    const declaration = statement.type === AST_NODE_TYPES.ExportNamedDeclaration ? statement.declaration : statement;
    const binding = declaration === null ? undefined : bindingOf(declaration, name);

    if (binding !== undefined) {
      return binding;
    }
  }

  return undefined;
}

function bindingOf(declaration: TSESTree.Node, name: string): FunctionNode | TSESTree.Expression | undefined {
  if (declaration.type === AST_NODE_TYPES.FunctionDeclaration) {
    return declaration.id?.name === name ? declaration : undefined;
  }

  if (declaration.type !== AST_NODE_TYPES.VariableDeclaration) {
    return undefined;
  }

  const declarator = declaration.declarations.find(
    ({ id }) => id.type === AST_NODE_TYPES.Identifier && id.name === name,
  );

  return declarator?.init ?? undefined;
}
