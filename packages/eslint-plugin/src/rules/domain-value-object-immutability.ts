import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { className } from '../support/classes/class-name.js';
import { constructorOf } from '../support/classes/constructor-of.js';
import { enclosingMember } from '../support/classes/enclosing-member.js';
import { isCallable } from '../support/classes/is-callable.js';
import { isConstructor } from '../support/classes/is-constructor.js';
import { memberName } from '../support/classes/member-name.js';
import { defineRule } from '../support/rule/define-rule.js';
import { propertyName } from '../support/globals/property-name.js';
import { parameterName } from '../support/members/parameter-name.js';
import { parameterProperties } from '../support/members/parameter-properties.js';
import { startsAtThis } from '../support/members/starts-at-this.js';

const ARRAY_MUTATORS = new Set(['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin']);

export const domainValueObjectImmutability = defineRule<'mutableProperty' | 'setter' | 'mutation'>({
  id: 'domain/value-object-immutability',
  type: 'problem',
  recommended: 'error',
  description: 'A value object is immutable: every property is readonly, there is no setter and no method writes to `this`.',
  messages: {
    mutableProperty: 'The property {{name}} of the value object {{className}} is not readonly. Mark it readonly: a value object never changes, an operation returns a new instance.',
    setter: 'The value object {{className}} has the setter {{name}}. Remove it and return a new {{className}} from a method named after the operation.',
    mutation: '{{className}} changes its own state ({{target}}). Return a new {{className}} built from the new values instead: a value object is immutable and compared by value.',
  },
  create({ file, sourceCode, report }) {
    const { location } = file;

    if (location.area !== 'context' || location.layer !== 'domain' || file.isTest || location.inside[0] !== 'value-objects') return {};

    const mutation = (node: TSESTree.Node, target: TSESTree.Node): void => {
      const site = enclosingMember(node);

      if (site === undefined || isConstructor(site.member) || !startsAtThis(target)) return;

      report({ node, messageId: 'mutation', data: { className: className(site.body.parent), target: sourceCode.getText(target) } });
    };

    return {
      ClassBody(body) {
        const owner = className(body.parent);

        for (const name of mutablePropertyNames(body)) report({ node: name.node, messageId: 'mutableProperty', data: { className: owner, name: name.text } });

        for (const member of body.body.filter(isSetter)) report({ node: member.key, messageId: 'setter', data: { className: owner, name: memberName(member) ?? '' } });
      },
      AssignmentExpression: (node) => mutation(node, node.left),
      UpdateExpression: (node) => mutation(node, node.argument),
      CallExpression(node) {
        if (node.callee.type === AST_NODE_TYPES.MemberExpression && ARRAY_MUTATORS.has(propertyName(node.callee) ?? '')) mutation(node, node.callee.object);
      },
    };
  },
});

interface Named {
  readonly node: TSESTree.Node;
  readonly text: string;
}

function mutablePropertyNames(body: TSESTree.ClassBody): Named[] {
  const fields = body.body.filter((member) => member.type === AST_NODE_TYPES.PropertyDefinition || member.type === AST_NODE_TYPES.AccessorProperty);
  const writable = fields.filter((member) => !member.readonly && !member.declare && !isCallable(member));
  const parameters = parameterProperties(constructorOf(body)).filter((property) => !property.readonly);

  return [...writable.map((member) => ({ node: member.key, text: memberName(member) ?? 'a computed key' })), ...parameters.map((property) => ({ node: property, text: parameterName(property) }))];
}

function isSetter(member: TSESTree.ClassElement): member is TSESTree.MethodDefinition {
  return member.type === AST_NODE_TYPES.MethodDefinition && member.kind === 'set';
}
