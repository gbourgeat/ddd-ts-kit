import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { defineRule } from '../support/rule/define-rule';
import { type TestCall, testCall } from '../support/tests/test-call';

/** The modifiers that leave a test aside, or run it alone. */
const ASIDE = new Set(['only', 'skip']);

/** The modifiers that decide on a condition: left aside for good when the condition is a constant. */
const CONDITIONAL = new Set(['skipIf', 'runIf']);

/** `fit` and `xit`, `fdescribe` and `xdescribe`: the same thing, spelt the Jasmine way. */
const PREFIXED = /^[fx](?:it|test|describe)$/;

const INSTEAD =
  'Every test runs on every machine: a behaviour not written yet is an `it.todo` named after it, a test that is wrong is fixed, and one that proves nothing any more is deleted.';

export const testNoOnlyNoSkip = defineRule<'modifier' | 'constant' | 'prefixed'>({
  id: 'test/no-only-no-skip',
  type: 'problem',
  recommended: 'error',
  description:
    'No `.only` or `.skip` on a test or a group, no `fit`, `xit`, `xdescribe`, no `.skipIf` or `.runIf` on a constant: every test runs, or runs wherever its condition holds; a behaviour not proven yet is an `it.todo`.',
  messages: {
    modifier: `\`{{what}}\` leaves tests aside: with \`only\` the others do not run, with \`skip\` this one does not, and the run is green while something is not proven. ${INSTEAD}`,
    constant: `\`{{what}}\` on a constant leaves this test aside for good, as \`.skip\` would, and the run is green while something is not proven. A condition says where the test runs (\`describe.runIf(process.env['VARNISH_URL'])\`); ${INSTEAD}`,
    prefixed: `\`{{what}}\` focuses or skips as \`.only\` and \`.skip\` do, and the run is green while something is not proven. ${INSTEAD}`,
  },
  create({ file, sourceCode, report }) {
    if (!file.isTest) {
      return {};
    }

    return {
      CallExpression(node: TSESTree.CallExpression) {
        const call = testCall(sourceCode, node);

        if (call === undefined) {
          return;
        }

        if (PREFIXED.test(call.root)) {
          report({ node: call.head, messageId: 'prefixed', data: { what: call.root } });
        }

        for (const modifier of call.modifiers.filter((name) => ASIDE.has(name))) {
          report({ node: call.head, messageId: 'modifier', data: { what: `${call.root}.${modifier}` } });
        }

        const conditional = call.modifiers.find((name) => CONDITIONAL.has(name));

        if (conditional !== undefined && onAConstant(call)) {
          report({ node: call.head, messageId: 'constant', data: { what: `${call.root}.${conditional}` } });
        }
      },
    };
  },
});

/** `it.skipIf(true)`, `describe.runIf(false)`, `it.skipIf('')`, `it.skipIf()`: a condition that never changes. */
function onAConstant({ head }: TestCall): boolean {
  if (head.type !== AST_NODE_TYPES.CallExpression) {
    return false;
  }

  const [condition] = head.arguments;

  return condition === undefined || condition.type === AST_NODE_TYPES.Literal;
}
