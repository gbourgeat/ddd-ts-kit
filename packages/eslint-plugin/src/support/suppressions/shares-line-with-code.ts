import type { TSESLint, TSESTree } from '@typescript-eslint/utils';

export function sharesLineWithCode(sourceCode: Readonly<TSESLint.SourceCode>, comment: TSESTree.Comment): boolean {
  const before = sourceCode.getTokenBefore(comment);

  return before !== null && before.loc.end.line === comment.loc.start.line;
}
