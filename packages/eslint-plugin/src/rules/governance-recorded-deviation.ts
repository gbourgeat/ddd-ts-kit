import type { TSESTree } from '@typescript-eslint/utils';
import { defineRule } from '../support/rule/define-rule';

interface Directive {
  /** `eslint-disable`, `eslint-disable-line`, `eslint-disable-next-line` or their `ddd-ts-kit-` twins. */
  readonly keyword: string;
  readonly rules: string;
  readonly reason: string;
}

const DIRECTIVE = /^((?:eslint|ddd-ts-kit)-disable(?:-next-line|-line)?)(?![\w-])(.*)$/s;
const REASON = /\s-{2,}\s*/;
const DECISION_RECORD = /\bADR-\d+\b/;
const OWN_NAME = /(?:^|\/)governance-recorded-deviation$/;

export const governanceRecordedDeviation = defineRule<'unrecorded' | 'blanket'>({
  id: 'governance/recorded-deviation',
  type: 'problem',
  recommended: 'error',
  description:
    'A suppression carries a reason that points to a decision record of docs/adr/, and names the rules it silences.',
  messages: {
    unrecorded:
      '`{{directive}}` on line {{line}} silences a rule without pointing to a decision. Fix the diagnostic; if the deviation is deliberate, record it with `ddd-ts-kit generate adr` (reason, scope, condition for removing it) and end the comment with `-- ADR-<number>: <reason>`.',
    blanket:
      '`{{directive}}` on line {{line}} names no rule: it silences every rule, the ones nobody thought of included. Name each rule it suppresses, record the decision with `ddd-ts-kit generate adr` and end the comment with `-- ADR-<number>: <reason>`.',
  },
  create({ sourceCode, report }) {
    return {
      Program() {
        for (const comment of sourceCode.getAllComments()) {
          const directive = parseDirective(comment.value);
          const messageId = directive === undefined ? undefined : judge(directive);

          if (directive === undefined || messageId === undefined) {
            continue;
          }

          report({
            loc: reportedAt(comment, directive),
            messageId,
            data: { directive: `${directive.keyword} ${directive.rules}`.trim(), line: comment.loc.start.line },
          });
        }
      },
    };
  },
});

function parseDirective(comment: string): Directive | undefined {
  const match = DIRECTIVE.exec(comment.trim());

  if (match === null) {
    return undefined;
  }

  const [, keyword = '', rest = ''] = match;
  const separator = REASON.exec(rest);

  if (separator === null) {
    return { keyword, rules: rest.trim(), reason: '' };
  }

  return {
    keyword,
    rules: rest.slice(0, separator.index).trim(),
    reason: rest.slice(separator.index + separator[0].length),
  };
}

function judge(directive: Directive): 'unrecorded' | 'blanket' | undefined {
  if (directive.rules === '') {
    return 'blanket';
  }

  return DECISION_RECORD.test(directive.reason) ? undefined : 'unrecorded';
}

/**
 * ESLint drops a report made at or after a directive that covers its rule. A directive that
 * covers this very rule is therefore reported just ahead of the range it silences: before the
 * first character of the file for `eslint-disable`, on the line above for `eslint-disable-line`.
 */
function reportedAt(comment: TSESTree.Comment, directive: Directive): TSESTree.SourceLocation | TSESTree.Position {
  if (!silencesThisRule(directive)) {
    return comment.loc;
  }

  if (directive.keyword === 'eslint-disable') {
    return { line: 1, column: -1 };
  }

  return directive.keyword === 'eslint-disable-line' ? { line: comment.loc.start.line - 1, column: 0 } : comment.loc;
}

function silencesThisRule(directive: Directive): boolean {
  return directive.rules === '' || directive.rules.split(/[\s,]+/).some((rule) => OWN_NAME.test(rule));
}
