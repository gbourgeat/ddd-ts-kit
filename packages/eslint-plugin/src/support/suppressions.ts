import { AST_TOKEN_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

const DIRECTIVE = /^ddd-ts-kit-disable-next-line\s+(\S+)\s+--\s*\S/;

/** Lines silenced for `ruleId` by the suppression comment the CLI checker understands too. */
export function suppressedLines(sourceCode: Readonly<TSESLint.SourceCode>, ruleId: string): ReadonlySet<number> {
  const lines = new Set<number>();
  for (const comment of sourceCode.getAllComments()) {
    if (comment.type !== AST_TOKEN_TYPES.Line || DIRECTIVE.exec(comment.value.trim())?.[1] !== ruleId) continue;
    if (!sharesLineWithCode(sourceCode, comment)) lines.add(comment.loc.end.line + 1);
  }
  return lines;
}

export function sharesLineWithCode(sourceCode: Readonly<TSESLint.SourceCode>, comment: TSESTree.Comment): boolean {
  const before = sourceCode.getTokenBefore(comment);
  return before !== null && before.loc.end.line === comment.loc.start.line;
}
