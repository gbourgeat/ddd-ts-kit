import { AST_NODE_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import type { ModuleShape } from './module-shape.js';

type Source = Readonly<TSESLint.SourceCode>;

/**
 * True when the exported functions of the module are the accessors of one private state: each
 * reads or writes a module-level variable that is not exported (`let current`, or a `const`
 * holding a `new Map()`), and those variables tie the functions into one group.
 */
export function sharesPrivateState(shape: ModuleShape, sourceCode: Source): boolean {
  const states = shape.declarations.flatMap((declaration) => (declaration.exported ? [] : stateOf(declaration.node)));
  const functions = shape.exports.filter((declaration) => declaration.node.type === AST_NODE_TYPES.FunctionDeclaration);
  const touched = functions.map((declaration) => states.filter((state) => isUsedIn(sourceCode, state, declaration.node)));

  return touched.length > 1 && touched.every((states) => states.length > 0) && isOneGroup(touched);
}

function stateOf(node: TSESTree.Node): TSESTree.VariableDeclarator[] {
  if (node.type !== AST_NODE_TYPES.VariableDeclarator) return [];

  return node.parent.kind === 'let' || node.parent.kind === 'var' || node.init?.type === AST_NODE_TYPES.NewExpression ? [node] : [];
}

function isUsedIn(sourceCode: Source, state: TSESTree.VariableDeclarator, user: TSESTree.Node): boolean {
  const references = sourceCode.getDeclaredVariables(state).flatMap((variable) => variable.references);

  return references.some(({ identifier }) => identifier.range[0] >= user.range[0] && identifier.range[1] <= user.range[1]);
}

function isOneGroup(touched: readonly (readonly TSESTree.Node[])[]): boolean {
  const group = new Set(touched[0]);
  let waiting = touched.slice(1);

  for (let joined = true; joined; ) {
    const joining = waiting.filter((states) => states.some((state) => group.has(state)));

    joining.flat().forEach((state) => group.add(state));
    waiting = waiting.filter((states) => !joining.includes(states));
    joined = joining.length > 0;
  }

  return waiting.length === 0;
}
