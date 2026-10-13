import { AST_NODE_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import { defineRule, type Report } from '../support/rule/define-rule.js';
import { propertyName } from '../support/globals/property-name.js';

type MessageId = 'roles' | 'roleTest';

const ROLE_SEARCHES = new Set(['includes', 'some', 'every', 'find', 'indexOf']);
const EQUALITY = new Set(['===', '!==', '==', '!=']);

const INSTEAD =
  'Answer every field the read model holds and mark the one reserved to some callers on the response schema: `withFieldAccess(schema, { internalNote: { read: { permission } } })` of @ddd-ts-kit/http. It is left out of JSON, XML and CSV alike for an actor who may not read it, the contract says so, and a form shows it read-only or not at all.';

export const authzFieldsBySchema = defineRule<MessageId>({
  id: 'authz/fields-by-schema',
  type: 'problem',
  recommended: 'error',
  description:
    'A query never shapes its answer by the roles of the actor: a field reserved to some callers is marked on the response schema with withFieldAccess.',
  messages: {
    roles: `The query tests {{access}}: an answer shaped by role differs in every representation and in no contract. ${INSTEAD}`,
    roleTest: `The query compares {{access}} with a role name. ${INSTEAD}`,
  },
  create({ file, sourceCode, report }) {
    const { location } = file;

    if (
      location.area !== 'context' ||
      location.layer !== 'application' ||
      file.isTest ||
      location.inside[0] !== 'queries'
    ) {
      return {};
    }

    return listeners(sourceCode, report);
  },
});

function listeners(sourceCode: Readonly<TSESLint.SourceCode>, report: Report<MessageId>): TSESLint.RuleListener {
  const roleTest = (node: TSESTree.Node, tested: TSESTree.Node): void => {
    if (namedAs(tested, 'role')) {
      report({ node, messageId: 'roleTest', data: { access: sourceCode.getText(tested) } });
    }
  };

  return {
    CallExpression(node) {
      const { callee } = node;

      if (callee.type !== AST_NODE_TYPES.MemberExpression || !ROLE_SEARCHES.has(propertyName(callee) ?? '')) {
        return;
      }

      if (namedAs(callee.object, 'roles')) {
        report({ node, messageId: 'roles', data: { access: sourceCode.getText(callee.object) } });
      }
    },
    MemberExpression(node) {
      if (propertyName(node) === 'isAdmin') {
        report({ node, messageId: 'roles', data: { access: sourceCode.getText(node) } });
      }
    },
    BinaryExpression(node) {
      if (EQUALITY.has(node.operator)) {
        roleTest(node, node.left);
        roleTest(node, node.right);
      }
    },
  };
}

/** `roles` or `role`, held by the actor (`query.actor.roles`) or taken out of it first (`const { roles } = query.actor`). */
function namedAs(node: TSESTree.Node, name: string): boolean {
  if (node.type === AST_NODE_TYPES.Identifier) {
    return node.name === name;
  }

  return node.type === AST_NODE_TYPES.MemberExpression && propertyName(node) === name;
}
