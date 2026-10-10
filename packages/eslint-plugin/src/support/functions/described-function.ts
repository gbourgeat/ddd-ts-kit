import { ASTUtils, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import type { FunctionNode } from './function-node.js';

interface DescribedFunction {
  /** `Function 'charge'`, `Method 'execute'`, `Arrow function`: how a report names it. */
  readonly name: string;
  /** The head of the function: where a report points. */
  readonly loc: TSESTree.SourceLocation;
}

export function describedFunction(node: FunctionNode, sourceCode: Readonly<TSESLint.SourceCode>): DescribedFunction {
  const name = ASTUtils.getFunctionNameWithKind(node, sourceCode);

  return { name: name.charAt(0).toUpperCase() + name.slice(1), loc: ASTUtils.getFunctionHeadLocation(node, sourceCode) };
}
