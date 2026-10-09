import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { defineRule } from '../support/define-rule.js';
import { propertyName } from '../support/globals.js';
import { startsAtThis } from '../support/members.js';

interface Options {
  readonly mutators?: readonly string[];
}

const DEFAULT_MUTATORS = ['save', 'delete', 'publish'];

export const applicationCommandQuerySeparation = defineRule<'mutation', [Options]>({
  id: 'application/command-query-separation',
  type: 'problem',
  recommended: 'warn',
  description: 'A query never changes state: nothing under application/queries calls `save`, `delete` or `publish` on a dependency.',
  messages: {
    mutation:
      'The query side calls {{call}}(): a query answers and never changes state. Move the change to a command handler (`ddd-ts-kit generate command {{context}} <UseCase>`) and let the caller send it.',
  },
  schema: [
    {
      type: 'object',
      additionalProperties: false,
      properties: { mutators: { type: 'array', items: { type: 'string' }, uniqueItems: true } },
    },
  ],
  defaultOptions: [{}],
  create({ file, sourceCode, options: [options], report }) {
    const { location } = file;
    if (location.area !== 'context' || location.layer !== 'application' || file.isTest || location.inside[0] !== 'queries') return {};
    const mutators = options.mutators ?? DEFAULT_MUTATORS;
    return {
      CallExpression(node) {
        const { callee } = node;
        // Only dependencies held by the handler are judged: `seen.delete(id)` on a local Set changes nothing outside.
        if (callee.type !== AST_NODE_TYPES.MemberExpression || !startsAtThis(callee.object)) return;
        if (mutators.includes(propertyName(callee) ?? '')) report({ node, messageId: 'mutation', data: { call: sourceCode.getText(callee), context: location.context } });
      },
    };
  },
});
