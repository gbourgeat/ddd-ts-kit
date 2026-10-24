import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { descendants } from '../support/descendants';
import { defineRule } from '../support/rule/define-rule';
import { testCall } from '../support/tests/test-call';

/** The statements and the expression that make a test decide instead of stating. */
const LOGIC: Readonly<Partial<Record<AST_NODE_TYPES, string>>> = {
  [AST_NODE_TYPES.IfStatement]: 'An `if`',
  [AST_NODE_TYPES.SwitchStatement]: 'A `switch`',
  [AST_NODE_TYPES.ConditionalExpression]: 'A ternary',
  [AST_NODE_TYPES.ForStatement]: 'A `for`',
  [AST_NODE_TYPES.ForInStatement]: 'A `for`',
  [AST_NODE_TYPES.ForOfStatement]: 'A `for`',
  [AST_NODE_TYPES.WhileStatement]: 'A `while`',
  [AST_NODE_TYPES.DoWhileStatement]: 'A `do`',
  [AST_NODE_TYPES.TryStatement]: 'A `try`',
};

export const testNoLogic = defineRule<'logic'>({
  id: 'test/no-logic',
  type: 'suggestion',
  recommended: 'warn',
  transition: '0.90.0',
  description:
    'A test holds no `if`, `switch`, ternary, loop or `try`: it arranges, acts and asserts; a case per row is an `it.each`, a decision belongs to a builder, a fake or a helper.',
  messages: {
    logic:
      '{{what}} in a test: a test holds no logic. It arranges, acts and asserts, and fails for one reason a reader finds without running it. A case per row is an `it.each` with the rows as its table; a decision belongs to a builder (`anInvoice().paid()`), to a fake (`mailer.failNextWith(...)`) or to a helper named after what it decides, in test/e2e/support or next to the world of the context.',
  },
  create({ file, sourceCode, report }) {
    if (!file.isTest) {
      return {};
    }

    return {
      CallExpression(node: TSESTree.CallExpression) {
        const call = testCall(sourceCode, node);

        if (call?.kind !== 'test' || call.body === undefined) {
          return;
        }

        for (const inside of descendants(call.body)) {
          const what = LOGIC[inside.type];

          if (what !== undefined) {
            report({ node: inside, messageId: 'logic', data: { what } });
          }
        }
      },
    };
  },
});
