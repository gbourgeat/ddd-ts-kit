import { AST_NODE_TYPES, type TSESLint } from '@typescript-eslint/utils';
import type { FunctionNode } from './function-node.js';

/** Lines of the body that hold code: blank lines and comment lines carry no token. */
export function codeLines(node: FunctionNode, sourceCode: Readonly<TSESLint.SourceCode>): number {
  const tokens = sourceCode.getTokens(node.body);
  const inside = node.body.type === AST_NODE_TYPES.BlockStatement ? tokens.slice(1, -1) : tokens;
  const lines = new Set<number>();

  for (const token of inside) {
    for (let line = token.loc.start.line; line <= token.loc.end.line; line += 1) lines.add(line);
  }

  return lines.size;
}
