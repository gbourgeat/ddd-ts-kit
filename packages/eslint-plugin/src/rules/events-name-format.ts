import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import type { ContextLocation } from '../project/location.js';
import { keyName } from '../support/classes/key-name.js';
import { defineRule } from '../support/rule/define-rule.js';
import { inContext } from '../support/imports/in-context.js';
import { staticString } from '../support/imports/static-string.js';

type Keyed = TSESTree.Property | TSESTree.PropertyDefinition;

const KEBAB_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const eventsNameFormat = defineRule<'format'>({
  id: 'events/name-format',
  type: 'problem',
  recommended: 'error',
  description: 'Domain and integration event names follow <context>.<aggregate>.<fact-in-past-tense>, in kebab-case.',
  messages: {
    format:
      'The event name "{{value}}" does not follow <context>.<aggregate>.<fact>. Name it "{{context}}.<aggregate>.<fact-in-past-tense>" in kebab-case, for example "{{context}}.invoice.issued".',
  },
  create({ file, report }) {
    const here = inContext(file);
    const key = here === undefined || file.isTest ? undefined : judgedKey(here);

    if (here === undefined || key === undefined) {
      return {};
    }

    const judge = (node: Keyed): void => {
      const value =
        node.value === null || node.computed || keyName(node.key) !== key ? undefined : staticString(node.value);

      if (value === undefined || isEventName(value, here.context)) {
        return;
      }

      // In a published language, `type: 'x'` may be a plain discriminator: outside a declaration only dotted values are event names.
      if (key === 'type' && !value.includes('.') && !isDeclarationOption(node)) {
        return;
      }

      report({ node: node.value ?? node, messageId: 'format', data: { value, context: here.context } });
    };

    return { Property: judge, PropertyDefinition: judge };
  },
});

/** A domain event carries its name in `name`, an integration event in the `type` of its declaration. */
function judgedKey(here: ContextLocation): 'name' | 'type' | undefined {
  if (here.layer === 'domain' && here.inside[0] === 'events') {
    return 'name';
  }

  return here.layer === 'published-language' ? 'type' : undefined;
}

function isEventName(value: string, context: string): boolean {
  const parts = value.split('.');

  return parts.length === 3 && parts[0] === context && parts.every((part) => KEBAB_SEGMENT.test(part));
}

function isDeclarationOption(node: Keyed): boolean {
  const call = node.parent.type === AST_NODE_TYPES.ObjectExpression ? node.parent.parent : undefined;

  if (call?.type !== AST_NODE_TYPES.CallExpression || call.arguments[0] !== node.parent) {
    return false;
  }

  return call.callee.type === AST_NODE_TYPES.Identifier && call.callee.name === 'defineIntegrationEvent';
}
