import { defineRule } from '../support/rule/define-rule.js';

const MAX_LINES = 350;

export const cleanFileSize = defineRule<'tooLong' | 'aggregateTooLong'>({
  id: 'clean/file-size',
  type: 'suggestion',
  recommended: 'error',
  description: 'A file is at most 350 lines, tests included: past that it holds more than one responsibility.',
  messages: {
    tooLong:
      'This file is {{count}} lines long (limit {{limit}}). It holds more than one responsibility: move each one to a file named after it (a class, a function with the types of its signature, a group of tests about one behaviour) until every file reads in one sitting.',
    aggregateTooLong:
      'This aggregate is {{count}} lines long (limit {{limit}}). Move a decision out: a domain service of domain/services/ that takes the state and returns the new state and its events, which the aggregate applies in its intention method; a value object for fields that travel together; an entity for a part with its own identity. Never a public method that sets the state from outside, and never a shortened comment, test or written rule.',
  },
  create({ file, sourceCode, report }) {
    if (file.path.endsWith('.d.ts') || file.path.split('/').includes('generated')) {
      return {};
    }

    return {
      Program() {
        const count = sourceCode.lines.at(-1) === '' ? sourceCode.lines.length - 1 : sourceCode.lines.length;

        if (count > MAX_LINES) {
          report({
            loc: { line: MAX_LINES + 1, column: 0 },
            messageId: file.path.endsWith('.aggregate.ts') ? 'aggregateTooLong' : 'tooLong',
            data: { count, limit: MAX_LINES },
          });
        }
      },
    };
  },
});
