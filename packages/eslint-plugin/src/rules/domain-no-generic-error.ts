import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { defineRule } from '../support/rule/define-rule.js';
import { ambientName } from '../support/globals/ambient-name.js';

export const domainNoGenericError = defineRule<'generic'>({
  id: 'domain/no-generic-error',
  type: 'problem',
  recommended: 'error',
  description:
    'No `throw new Error(...)` in domain/ or application/: an expected failure is a DomainError with a stable code.',
  messages: {
    generic:
      'A generic Error says nothing a caller can act on. Throw a DomainError with a stable code (`ddd-ts-kit generate domain-error {{context}} <Name>`): presentation maps the code to a status in one place.',
  },
  create({ file, sourceCode, report }) {
    const { location } = file;

    if (
      location.area !== 'context' ||
      file.isTest ||
      (location.layer !== 'domain' && location.layer !== 'application')
    ) {
      return {};
    }

    return {
      ThrowStatement(node) {
        const thrown = node.argument;

        if (thrown.type !== AST_NODE_TYPES.NewExpression && thrown.type !== AST_NODE_TYPES.CallExpression) {
          return;
        }

        if (ambientName(sourceCode, thrown.callee) === 'Error') {
          report({ node: thrown, messageId: 'generic', data: { context: location.context } });
        }
      },
    };
  },
});
