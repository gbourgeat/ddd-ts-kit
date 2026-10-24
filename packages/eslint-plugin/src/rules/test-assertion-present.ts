import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { descendants } from '../support/descendants';
import { propertyName } from '../support/globals/property-name';
import { defineRule } from '../support/rule/define-rule';
import { testCall } from '../support/tests/test-call';
import { titleText } from '../support/tests/title-text';

/** `expect`, `expectRefusal`, `expectProblem`, `assertEquals`: a call that asserts, of the runner, of the kit or of the project. */
const ASSERTION = /^(?:expect|assert)/;

/** The outcome of a scenario of `@ddd-ts-kit/testing`: `thenEvents`, `thenError`, `thenState`, `thenNoEvent`. */
const OUTCOME = /^then[A-Z]/;

export const testAssertionPresent = defineRule<'none' | 'pending'>({
  id: 'test/assertion-present',
  type: 'problem',
  recommended: 'warn',
  transition: '0.90.0',
  description:
    'Every test asserts something: an `expect`, an `expect...` or `assert...` helper, or the outcome of a scenario (`thenEvents`, `thenError`); a test without a body is written `it.todo`.',
  messages: {
    none: 'The test "{{title}}" asserts nothing: it runs code and passes whatever happens. Assert the outcome: the state of a fake (`expect(await invoices.findById(id))`), the facts recorded (`thenEvents`), the refusal by its code (`thenError`, `expectRefusal`, `rejects.toMatchObject({ code })`), the answer of a route (`expectStatus`, `expectProblem`). A helper that asserts for several tests is named `expect...`, so that the rule sees it.',
    pending:
      'The test "{{title}}" has no body: Vitest counts it as a todo and Jest refuses it. Write `it.todo(\'...\')` for a behaviour not proven yet, named after it, or write the test.',
  },
  create({ file, sourceCode, report }) {
    if (!file.isTest) {
      return {};
    }

    return {
      CallExpression(node: TSESTree.CallExpression) {
        const call = testCall(sourceCode, node);

        if (call?.kind !== 'test' || call.modifiers.includes('todo') || call.title === undefined) {
          return;
        }

        const title = titleText(call.title) ?? sourceCode.getText(call.title);

        if (call.body === undefined) {
          report({ node: call.title, messageId: 'pending', data: { title } });

          return;
        }

        if (!asserts(call.body)) {
          report({ node: call.title, messageId: 'none', data: { title } });
        }
      },
    };
  },
});

/** True when a call below `body` asserts: the body itself, or the scenario `pending(...)` wraps. */
function asserts(body: TSESTree.Node): boolean {
  for (const inside of descendants(body)) {
    if (inside.type === AST_NODE_TYPES.CallExpression && isAssertion(inside.callee)) {
      return true;
    }
  }

  return false;
}

function isAssertion(callee: TSESTree.Expression): boolean {
  if (callee.type === AST_NODE_TYPES.Identifier) {
    return ASSERTION.test(callee.name);
  }

  if (callee.type !== AST_NODE_TYPES.MemberExpression) {
    return false;
  }

  const name = propertyName(callee) ?? '';

  return ASSERTION.test(name) || OUTCOME.test(name) || rootOf(callee)?.name === 'expect';
}

/** `expect` for `expect.soft(x).toBe(y)`: the identifier a chain of members and calls starts from. */
function rootOf(callee: TSESTree.MemberExpression): TSESTree.Identifier | undefined {
  let current: TSESTree.Expression = callee.object;

  while (current.type === AST_NODE_TYPES.MemberExpression || current.type === AST_NODE_TYPES.CallExpression) {
    current = current.type === AST_NODE_TYPES.MemberExpression ? current.object : current.callee;
  }

  return current.type === AST_NODE_TYPES.Identifier ? current : undefined;
}
