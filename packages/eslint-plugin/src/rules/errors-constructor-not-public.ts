import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { className } from '../support/classes/class-name.js';
import { constructorOf } from '../support/classes/constructor-of.js';
import { visibilityOf } from '../support/classes/visibility-of.js';
import { isErrorClass } from '../support/errors/is-error-class.js';
import { isErrorFile } from '../support/errors/is-error-file.js';
import { defineRule } from '../support/rule/define-rule.js';

export const errorsConstructorNotPublic = defineRule<'publicConstructor' | 'inheritedPublic'>({
  id: 'errors/constructor-not-public',
  type: 'problem',
  recommended: 'error',
  description:
    'Under "stack.refusals": "factories", the constructor of an error class of domain/errors/ is not public: the class extends ConceptError and declares none, or declares it private or protected.',
  messages: {
    publicConstructor:
      'The constructor of {{className}} is public: anyone can build a refusal with a code and a message of their own. Extend ConceptError of @ddd-ts-kit/kernel and remove the constructor (its own is protected), then build each refusal in a static factory with `{{className}}.refusal(code, message, facts)`.',
    inheritedPublic:
      '{{className}} extends DomainError and declares no constructor, so it inherits a public one. Extend ConceptError of @ddd-ts-kit/kernel, whose constructor is protected, and build each refusal in a static factory with `{{className}}.refusal(code, message, facts)`.',
  },
  create({ file, report }) {
    if (!isErrorFile(file)) {
      return {};
    }

    return {
      ClassBody(body) {
        const owner = body.parent;

        if (!isErrorClass(owner) || owner.abstract) {
          return;
        }

        const constructor = constructorOf(body);
        const data = { className: className(owner) };

        if (constructor !== undefined && visibilityOf(constructor) === 'public') {
          report({ node: constructor.key, messageId: 'publicConstructor', data });
        }

        if (
          constructor === undefined &&
          owner.superClass?.type === AST_NODE_TYPES.Identifier &&
          owner.superClass.name === 'DomainError'
        ) {
          report({ node: owner.id ?? owner, messageId: 'inheritedPublic', data });
        }
      },
    };
  },
});
