import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { calleeName } from '../calls/callee-name.js';

/** The name of a binding call (`bind`, `rebind`, `resolve`, `fake`, `override`), or undefined for any other call. */
type BindingCallReader = (node: TSESTree.CallExpression) => string | undefined;

const BINDING_CALLS = new Set(['bind', 'rebind', 'resolve', 'fake', 'override']);
const DI = /^@ddd-ts-kit\/di(?:\/|$)/;
/** `Promise.resolve`, `path.resolve`, `require.resolve`, `import.meta.resolve` resolve something else. */
const OTHER_RESOLVERS = new Set(['Promise', 'path', 'require', 'meta']);

/**
 * Reads binding calls, plain or as a member (`builder.bind(X)`, `app.resolve(X)`), only in a
 * program that imports something from `@ddd-ts-kit/di`: elsewhere `resolve('x')` is another call.
 */
export function bindingCallReader(program: TSESTree.Program): BindingCallReader {
  const wires = program.body.some((statement) => statement.type === AST_NODE_TYPES.ImportDeclaration && DI.test(statement.source.value));

  return (node) => {
    const name = calleeName(node);

    return wires && name !== undefined && BINDING_CALLS.has(name) && !isOtherResolver(node.callee) ? name : undefined;
  };
}

function isOtherResolver(callee: TSESTree.Expression): boolean {
  if (callee.type !== AST_NODE_TYPES.MemberExpression) return false;

  const receiver = callee.object.type === AST_NODE_TYPES.MetaProperty ? callee.object.property : callee.object;

  return receiver.type === AST_NODE_TYPES.Identifier && OTHER_RESOLVERS.has(receiver.name);
}
