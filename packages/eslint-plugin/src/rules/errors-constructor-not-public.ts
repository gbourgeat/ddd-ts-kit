import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { className } from '../support/classes/class-name';
import { constructorOf } from '../support/classes/constructor-of';
import { visibilityOf } from '../support/classes/visibility-of';
import { isErrorClass } from '../support/errors/is-error-class';
import { isErrorFile } from '../support/errors/is-error-file';
import { defineRule } from '../support/rule/define-rule';

type MessageId = 'publicConstructor' | 'inheritedPublic' | 'publicRefusalConstructor' | 'inheritedPublicRefusal';

/** The messages of each form: a concept class extends `ConceptError`, a named refusal `DomainRefusal`. */
const MESSAGES = {
  factories: { declared: 'publicConstructor', inherited: 'inheritedPublic' },
  named: { declared: 'publicRefusalConstructor', inherited: 'inheritedPublicRefusal' },
} as const;

export const errorsConstructorNotPublic = defineRule<MessageId>({
  id: 'errors/constructor-not-public',
  type: 'problem',
  recommended: 'error',
  description:
    'Under "stack.refusals": "factories" or "named", the constructor of an error class of domain/errors/ is not public: the class extends ConceptError or DomainRefusal and declares none, or declares it private or protected.',
  messages: {
    publicConstructor:
      'The constructor of {{className}} is public: anyone can build a refusal with a code and a message of their own. Extend ConceptError of @ddd-ts-kit/kernel and remove the constructor (its own is protected), then build each refusal in a static factory with `{{className}}.refusal(code, message, facts)`.',
    inheritedPublic:
      '{{className}} extends DomainError and declares no constructor, so it inherits a public one. Extend ConceptError of @ddd-ts-kit/kernel, whose constructor is protected, and build each refusal in a static factory with `{{className}}.refusal(code, message, facts)`.',
    publicRefusalConstructor:
      'The constructor of {{className}} is public: anyone can build this refusal with a message of their own. Remove it: DomainRefusal of @ddd-ts-kit/kernel has a protected one, and each factory builds the refusal with `{{className}}.refusal(message, facts)`.',
    inheritedPublicRefusal:
      '{{className}} extends DomainError and declares no constructor, so it inherits a public one. Extend DomainRefusal of @ddd-ts-kit/kernel, whose constructor is protected, and build the refusal in static factories with `{{className}}.refusal(message, facts)`.',
  },
  create({ file, report }) {
    if (!isErrorFile(file)) {
      return {};
    }

    const messages = file.config.stack.refusals === 'named' ? MESSAGES.named : MESSAGES.factories;

    return {
      ClassBody(body) {
        const owner = body.parent;

        if (!isErrorClass(owner) || owner.abstract) {
          return;
        }

        const constructor = constructorOf(body);
        const data = { className: className(owner) };

        if (constructor !== undefined && visibilityOf(constructor) === 'public') {
          report({ node: constructor.key, messageId: messages.declared, data });
        }

        if (
          constructor === undefined &&
          owner.superClass?.type === AST_NODE_TYPES.Identifier &&
          owner.superClass.name === 'DomainError'
        ) {
          report({ node: owner.id ?? owner, messageId: messages.inherited, data });
        }
      },
    };
  },
});
