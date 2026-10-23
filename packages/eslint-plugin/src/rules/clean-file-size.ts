import { isGeneratedContextFile } from '../support/declarations/is-generated-context-file';
import { defineRule } from '../support/rule/define-rule';

const MAX_LINES = 350;

export const cleanFileSize = defineRule<'tooLong' | 'aggregateTooLong' | 'e2eSpecTooLong'>({
  id: 'clean/file-size',
  type: 'suggestion',
  recommended: 'error',
  description: 'A file is at most 350 lines, tests included: past that it holds more than one responsibility.',
  messages: {
    tooLong:
      'This file is {{count}} lines long (limit {{limit}}). It holds more than one responsibility: move each one to a file named after it (a class, a function with the types of its signature, a group of tests about one behaviour) until every file reads in one sitting.',
    aggregateTooLong:
      'This aggregate is {{count}} lines long (limit {{limit}}). Move a decision out: a domain service of domain/services/ that takes the state and returns the new state and its events, which the aggregate applies in its intention method; a value object for fields that travel together; an entity for a part with its own identity. Never a public method that sets the state from outside, and never a shortened comment, test or written rule.',
    e2eSpecTooLong:
      'This end-to-end spec is {{count}} lines long (limit {{limit}}). Split it by behaviour into parts named after it, beside it: test/e2e/<use-case>-<behaviour>.e2e.spec.ts next to test/e2e/<use-case>.e2e.spec.ts (the guard lets that name be written by hand), each part with its own describe. Move what the parts share (signing a person in, a world) to test/e2e/support/<context>/ instead of copying it.',
  },
  create({ file, sourceCode, report }) {
    if (file.path.endsWith('.d.ts') || file.path.split('/').includes('generated') || isGeneratedContextFile(file)) {
      return {};
    }

    return {
      Program() {
        const count = sourceCode.lines.at(-1) === '' ? sourceCode.lines.length - 1 : sourceCode.lines.length;

        if (count > MAX_LINES) {
          report({
            loc: { line: MAX_LINES + 1, column: 0 },
            messageId: messageIdOf(file.path),
            data: { count, limit: MAX_LINES },
          });
        }
      },
    };
  },
});

function messageIdOf(path: string): 'tooLong' | 'aggregateTooLong' | 'e2eSpecTooLong' {
  if (path.endsWith('.aggregate.ts')) {
    return 'aggregateTooLong';
  }

  return path.endsWith('.e2e.spec.ts') ? 'e2eSpecTooLong' : 'tooLong';
}
