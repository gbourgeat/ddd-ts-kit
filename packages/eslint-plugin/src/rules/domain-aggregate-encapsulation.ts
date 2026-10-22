import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { className } from '../support/classes/class-name';
import { constructorOf } from '../support/classes/constructor-of';
import { isCallable } from '../support/classes/is-callable';
import { memberName } from '../support/classes/member-name';
import { visibilityOf } from '../support/classes/visibility-of';
import { defineRule, type Report } from '../support/rule/define-rule';
import { parameterName } from '../support/members/parameter-name';
import { parameterProperties } from '../support/members/parameter-properties';
import { startsAtThis } from '../support/members/starts-at-this';

type MessageId = 'publicConstructor' | 'missingConstructor' | 'publicMutableProperty' | 'setter';

const GUARDED_DIRECTORIES = ['aggregates', 'entities'];

export const domainAggregateEncapsulation = defineRule<MessageId>({
  id: 'domain/aggregate-encapsulation',
  type: 'problem',
  recommended: 'error',
  description:
    'An aggregate or an entity has a private or protected constructor, no public mutable property and no setter: state changes through methods named after the business intention.',
  messages: {
    publicConstructor:
      'The constructor of {{className}} is public. Make it private (protected for a base class) and create instances through `create` for a birth and `rehydrate` for a load, so that no invalid {{className}} can exist.',
    missingConstructor:
      '{{className}} has no constructor, so anyone can instantiate it without its invariants. Declare a private constructor and the `create` and `rehydrate` factories.',
    publicMutableProperty:
      'The property {{name}} of {{className}} can be written from outside. Make it private or readonly and change it through a method named after the business intention.',
    setter:
      '{{name}} is a setter: it changes {{className}} without saying why. Replace it with a method named after the business intention, which guards its invariants and records the event.',
  },
  create({ file, report }) {
    const { location } = file;

    if (
      location.area !== 'context' ||
      location.layer !== 'domain' ||
      file.isTest ||
      !GUARDED_DIRECTORIES.includes(location.inside[0] ?? '')
    ) {
      return {};
    }

    return {
      ClassBody(body) {
        const owner = className(body.parent);

        judgeConstructor(body, owner, report);

        for (const node of mutableProperties(body)) {
          report({ node, messageId: 'publicMutableProperty', data: { className: owner, name: propertyLabel(node) } });
        }

        for (const member of body.body.filter(isSetter)) {
          report({
            node: member.key,
            messageId: 'setter',
            data: { className: owner, name: memberName(member) ?? 'This method' },
          });
        }
      },
    };
  },
});

function judgeConstructor(body: TSESTree.ClassBody, owner: string, report: Report<MessageId>): void {
  if (body.parent.abstract) {
    return;
  }

  const constructor = constructorOf(body);

  if (constructor !== undefined && visibilityOf(constructor) === 'public') {
    report({ node: constructor.key, messageId: 'publicConstructor', data: { className: owner } });
  }

  // A subclass without a constructor inherits the visibility of its base: the kernel bases are protected.
  if (constructor === undefined && body.parent.superClass === null) {
    report({ node: body.parent.id ?? body.parent, messageId: 'missingConstructor', data: { className: owner } });
  }
}

function mutableProperties(
  body: TSESTree.ClassBody,
): (TSESTree.PropertyDefinition | TSESTree.AccessorProperty | TSESTree.TSParameterProperty)[] {
  const fields = body.body.filter(
    (member) => member.type === AST_NODE_TYPES.PropertyDefinition || member.type === AST_NODE_TYPES.AccessorProperty,
  );

  const exposed = fields.filter(
    (member) => visibilityOf(member) === 'public' && !member.readonly && !member.declare && !isCallable(member),
  );

  const parameters = parameterProperties(constructorOf(body)).filter(
    (property) => property.accessibility === 'public' && !property.readonly,
  );

  return [...exposed, ...parameters];
}

function propertyLabel(
  node: TSESTree.PropertyDefinition | TSESTree.AccessorProperty | TSESTree.TSParameterProperty,
): string {
  return node.type === AST_NODE_TYPES.TSParameterProperty
    ? parameterName(node)
    : (memberName(node) ?? 'a computed key');
}

function isSetter(member: TSESTree.ClassElement): member is TSESTree.MethodDefinition {
  if (member.type !== AST_NODE_TYPES.MethodDefinition || visibilityOf(member) !== 'public') {
    return false;
  }

  if (member.kind === 'set') {
    return true;
  }

  return member.kind === 'method' && /^set[A-Z]/.test(memberName(member) ?? '') && onlyAssigns(member.value.body);
}

function onlyAssigns(body: TSESTree.BlockStatement | null | undefined): boolean {
  const statements = body?.body ?? [];

  return statements.length > 0 && statements.every(isAssignmentToThis);
}

function isAssignmentToThis(statement: TSESTree.Statement): boolean {
  if (
    statement.type !== AST_NODE_TYPES.ExpressionStatement ||
    statement.expression.type !== AST_NODE_TYPES.AssignmentExpression
  ) {
    return false;
  }

  return startsAtThis(statement.expression.left);
}
