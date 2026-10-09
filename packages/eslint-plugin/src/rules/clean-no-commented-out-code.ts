import type { TSESLint } from '@typescript-eslint/utils';
import { isCommentedOutCode, isFragment } from '../support/commented-code.js';
import { commentLines, isDirective, type CommentLine } from '../support/comments.js';
import { defineRule } from '../support/define-rule.js';

export const cleanNoCommentedOutCode = defineRule<'code'>({
  id: 'clean/no-commented-out-code',
  type: 'suggestion',
  recommended: 'error',
  description: 'No code in comments. Version control remembers.',
  messages: {
    code: 'The comment holds code: "{{excerpt}}". Delete it: version control keeps the old version, and code that does not run misleads the reader.',
  },
  create({ context, sourceCode, report }) {
    const { parser } = context.languageOptions;
    return {
      Program() {
        for (const paragraph of paragraphs(sourceCode)) {
          const culprit = firstCodeLine(paragraph, parser);
          if (culprit !== undefined) report({ loc: culprit.loc, messageId: 'code', data: { excerpt: culprit.text.slice(0, 60) } });
        }
      },
    };
  },
});

/** Consecutive comment lines are read together: a commented-out block is one finding. */
function paragraphs(sourceCode: Readonly<TSESLint.SourceCode>): CommentLine[][] {
  const groups: CommentLine[][] = [];
  let previous: CommentLine | undefined;
  for (const line of commentLines(sourceCode)) {
    if (line.jsdoc || line.sample || line.text === '' || isDirective(line.text)) continue;
    const current = previous !== undefined && continues(previous, line) ? groups.at(-1) : undefined;
    if (current === undefined) groups.push([line]);
    else current.push(line);
    previous = line;
  }
  return groups;
}

function continues(previous: CommentLine, line: CommentLine): boolean {
  if (previous.trailing || line.trailing || line.loc.start.line !== previous.loc.start.line + 1) return false;
  return previous.comment === line.comment || (!previous.block && !line.block);
}

function firstCodeLine(paragraph: readonly CommentLine[], parser: TSESLint.Parser.LooseParserModule | undefined): CommentLine | undefined {
  const whole = paragraph.map((line) => line.text).join('\n');
  if (paragraph.length > 1 && isCommentedOutCode(whole, parser)) return paragraph[0];
  return paragraph.find((line) => isCommentedOutCode(line.text, parser)) ?? paragraph.find((line) => isFragment(line.text));
}
