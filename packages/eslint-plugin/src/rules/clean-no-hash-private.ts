import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { className } from '../support/classes/class-name';
import { defineRule } from '../support/rule/define-rule';
import { hashPrivateFix } from '../support/hash-private-fix';

export const cleanNoHashPrivate = defineRule<'hash'>({
  id: 'clean/no-hash-private',
  type: 'suggestion',
  recommended: 'error',
  fixable: 'code',
  description:
    'A class member is `private`, never `#name`: one way to say private, the one the compiler checks and the tools of the kit read.',
  messages: {
    hash: '{{className}} declares #{{name}}. Write `private {{name}}`: a member is hidden with the `private` keyword, which reads the same on a field, a method, an accessor and a constructor parameter.',
  },
  create({ sourceCode, report }) {
    return {
      PrivateIdentifier(node: TSESTree.PrivateIdentifier) {
        const member = node.parent;
        const owner = member.parent?.parent;

        if (member.type === AST_NODE_TYPES.MemberExpression || member.type === AST_NODE_TYPES.BinaryExpression) {
          return;
        }

        if (owner?.type !== AST_NODE_TYPES.ClassDeclaration && owner?.type !== AST_NODE_TYPES.ClassExpression) {
          return;
        }

        const fix = hashPrivateFix(sourceCode, owner, node.name);

        report({
          node,
          messageId: 'hash',
          data: { className: className(owner), name: node.name },
          ...(fix === undefined ? {} : { fix }),
        });
      },
    };
  },
});
