import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { defineRule } from '../support/rule/define-rule.js';

const ERRORS_DIRECTORY = /(^|\/)domain\/errors\//;

export const errorsThroughFactory = defineRule<'constructed'>({
  id: 'errors/through-factory',
  type: 'problem',
  recommended: 'error',
  description:
    'Under "stack.refusals": "factories", a domain error is built by a static factory of its concept class: no `new` of a class of domain/errors/ outside that class.',
  messages: {
    constructed:
      '`new {{name}}(...)` builds a refusal outside its error class, with whatever code and message the caller writes. Call the static factory named after the refusal, `throw <Concept>Error.<refusal>(...)`, and add it when it is missing: `ddd-ts-kit generate error {{context}} <Concept> <refusal>`.',
  },
  create({ file, report }) {
    const { location } = file;

    if (file.config.stack.refusals !== 'factories' || location.area !== 'context') {
      return {};
    }

    const errors = new Set<string>();

    return {
      ImportDeclaration(node) {
        if (ERRORS_DIRECTORY.test(node.source.value)) {
          for (const name of importedNames(node)) {
            errors.add(name);
          }
        }
      },
      NewExpression(node) {
        if (node.callee.type === AST_NODE_TYPES.Identifier && errors.has(node.callee.name)) {
          report({ node, messageId: 'constructed', data: { name: node.callee.name, context: location.context } });
        }
      },
    };
  },
});

function importedNames(node: TSESTree.ImportDeclaration): string[] {
  return node.specifiers
    .filter((specifier) => specifier.type === AST_NODE_TYPES.ImportSpecifier)
    .map((specifier) => specifier.local.name);
}
