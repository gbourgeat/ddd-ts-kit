import { AST_TOKEN_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import { sharesLineWithCode } from './suppressions.js';

/** One line of comment text, whatever the comment syntax, with what the comment rules need to know. */
export interface CommentLine {
  readonly text: string;
  readonly loc: TSESTree.SourceLocation;
  readonly comment: TSESTree.Comment;
  readonly block: boolean;
  readonly jsdoc: boolean;
  /** True when code precedes the comment on its line. */
  readonly trailing: boolean;
  /** Inside a JSDoc `@example` or a fenced block: code is expected there. */
  readonly sample: boolean;
}

const DIRECTIVE = /^(?:\/?ddd-ts-kit[-:]|eslint-|@ts-|prettier-|biome-|istanbul |c8 |v8 |#region|#endregion|@vitest-|@jest-|\/ <reference|global |globals |jshint |jscs:)/;

/** Comments that are instructions to a tool, not prose: never judged as code or noise. */
export function isDirective(text: string): boolean {
  return DIRECTIVE.test(text);
}

export function isJsdoc(comment: TSESTree.Comment): boolean {
  return comment.type === AST_TOKEN_TYPES.Block && comment.value.startsWith('*') && !comment.value.startsWith('*/');
}

export function commentLines(sourceCode: Readonly<TSESLint.SourceCode>): CommentLine[] {
  return sourceCode.getAllComments().flatMap((comment) => (comment.type === AST_TOKEN_TYPES.Line ? [lineOf(sourceCode, comment)] : blockLines(sourceCode, comment)));
}

function lineOf(sourceCode: Readonly<TSESLint.SourceCode>, comment: TSESTree.Comment): CommentLine {
  return { text: comment.value.trim(), loc: comment.loc, comment, block: false, jsdoc: false, trailing: sharesLineWithCode(sourceCode, comment), sample: false };
}

function blockLines(sourceCode: Readonly<TSESLint.SourceCode>, comment: TSESTree.Comment): CommentLine[] {
  const jsdoc = isJsdoc(comment);
  let inExample = false;
  let fenced = false;
  return comment.value.split('\n').map((raw, index) => {
    const text = raw.replace(/^\s*\*+ ?/, '').trim();
    const fence = text.startsWith('```');
    if (fence) fenced = !fenced;
    else if (text.startsWith('@')) inExample = text.startsWith('@example');
    return { text, loc: lineLocation(sourceCode, comment.loc.start.line + index), comment, block: true, jsdoc, trailing: false, sample: inExample || fenced || fence };
  });
}

function lineLocation(sourceCode: Readonly<TSESLint.SourceCode>, line: number): TSESTree.SourceLocation {
  return { start: { line, column: 0 }, end: { line, column: sourceCode.lines[line - 1]?.length ?? 0 } };
}
