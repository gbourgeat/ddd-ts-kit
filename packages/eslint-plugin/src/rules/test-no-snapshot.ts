import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { propertyName } from '../support/globals/property-name';
import { defineRule } from '../support/rule/define-rule';

const SNAPSHOT_MATCHERS = new Set([
  'toMatchSnapshot',
  'toMatchInlineSnapshot',
  'toMatchFileSnapshot',
  'toThrowErrorMatchingSnapshot',
  'toThrowErrorMatchingInlineSnapshot',
]);

export const testNoSnapshot = defineRule<'snapshot'>({
  id: 'test/no-snapshot',
  type: 'problem',
  recommended: 'error',
  description:
    'No snapshot matcher in a test: a snapshot records whatever the code produced and is renewed with one flag; a test asserts the fields the rule depends on.',
  messages: {
    snapshot:
      '`{{matcher}}` records whatever the code produced and is renewed with one flag: it asserts nothing a reader can check against the rule. Assert the fields the rule depends on: `toEqual` on a small value built in the test, `toMatchObject` on the facts that matter, `thenEvents` on the facts recorded.',
  },
  create({ file, report }) {
    if (!file.isTest) {
      return {};
    }

    return {
      CallExpression(node: TSESTree.CallExpression) {
        const { callee } = node;

        if (callee.type !== AST_NODE_TYPES.MemberExpression) {
          return;
        }

        const matcher = propertyName(callee) ?? '';

        if (SNAPSHOT_MATCHERS.has(matcher)) {
          report({ node: callee.property, messageId: 'snapshot', data: { matcher } });
        }
      },
    };
  },
});
