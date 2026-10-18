import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { isRefusalClass } from '../support/errors/is-refusal-class.js';
import { defineRule } from '../support/rule/define-rule.js';

const ERRORS_DIRECTORY = /(^|\/)domain\/errors\//;

export const errorsThroughFactory = defineRule<'constructed' | 'constructedRefusal'>({
  id: 'errors/through-factory',
  type: 'problem',
  recommended: 'error',
  description:
    'Under "stack.refusals": "factories" or "named", a domain error is built by a static factory of its class: no `new` of a class of domain/errors/ outside that class, nor of a class extending DomainRefusal.',
  messages: {
    constructed:
      '`new {{name}}(...)` builds a refusal outside its error class, with whatever code and message the caller writes. Call the static factory named after the refusal, `throw <Concept>Error.<refusal>(...)`, and add it when it is missing: `ddd-ts-kit generate error {{context}} <Concept> <refusal>`.',
    constructedRefusal:
      '`new {{name}}(...)` builds a refusal without its factory, with whatever message the caller writes. Call a static factory named after what the refusal is about, `throw {{name}}.for<Subject>(...)`, and add it when it is missing: `ddd-ts-kit generate error {{context}} {{name}} for<Subject>`.',
  },
  create({ file, report }) {
    const { location } = file;
    const form = file.config.stack.refusals;

    if (form === 'classes' || location.area !== 'context') {
      return {};
    }

    const errors = new Set<string>();
    const constructions: TSESTree.NewExpression[] = [];
    const messageId = form === 'named' ? 'constructedRefusal' : 'constructed';

    return {
      ImportDeclaration(node) {
        if (ERRORS_DIRECTORY.test(node.source.value)) {
          importedNames(node).forEach((name) => errors.add(name));
        }
      },
      // A named refusal is built by `refusal(...)`, in its own factories too: `new` of it is refused everywhere.
      'ClassDeclaration, ClassExpression'(node: TSESTree.ClassDeclaration | TSESTree.ClassExpression) {
        if (form === 'named' && node.id !== null && isRefusalClass(node)) {
          errors.add(node.id.name);
        }
      },
      NewExpression(node) {
        constructions.push(node);
      },
      'Program:exit'() {
        for (const node of constructions.filter((construction) => builds(construction, errors))) {
          report({ node, messageId, data: { name: calleeName(node), context: location.context } });
        }
      },
    };
  },
});

function builds(node: TSESTree.NewExpression, errors: ReadonlySet<string>): boolean {
  return errors.has(calleeName(node));
}

function calleeName(node: TSESTree.NewExpression): string {
  return node.callee.type === AST_NODE_TYPES.Identifier ? node.callee.name : '';
}

function importedNames(node: TSESTree.ImportDeclaration): string[] {
  return node.specifiers
    .filter((specifier) => specifier.type === AST_NODE_TYPES.ImportSpecifier)
    .map((specifier) => specifier.local.name);
}
