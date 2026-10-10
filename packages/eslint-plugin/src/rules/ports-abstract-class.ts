import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { className } from '../support/classes/class-name.js';
import { memberName } from '../support/classes/member-name.js';
import { visibilityOf } from '../support/classes/visibility-of.js';
import { defineRule } from '../support/rule/define-rule.js';
import { staticString } from '../support/imports/static-string.js';
import { isPortFile } from '../support/ports/is-port-file.js';

const PORT =
  'A port is an abstract class with abstract members only: the class is the contract and the injection token at once.';

export const portsAbstractClass = defineRule<'concrete' | 'member' | 'interface'>({
  id: 'ports/abstract-class',
  type: 'problem',
  recommended: 'error',
  description:
    'A port is an abstract class with abstract members only: no constructor, no private or protected member, no body, no initializer.',
  messages: {
    concrete: `{{className}} is declared in a port file but is not abstract. ${PORT} Write \`export abstract class {{className}}\` and move what it implements to an adapter in infrastructure/ that \`implements {{className}}\`.`,
    member: `{{className}} has {{what}}. ${PORT} Keep \`abstract\` method signatures and \`abstract readonly\` properties here (and \`static readonly tokenKey\` when the port is published in a package), and move the rest to the adapter.`,
    interface:
      '{{name}} is an interface in a port file. Declare the port as an abstract class: it is also its injection token. Write `export abstract class {{name}}` with `abstract` members; a data shape that travels through the port may stay a `type`.',
  },
  create({ file, report }) {
    if (!isPortFile(file.config, file.path)) {
      return {};
    }

    const judge = (node: TSESTree.ClassDeclaration | TSESTree.ClassExpression): void => {
      if (!node.abstract) {
        report({ node: node.id ?? node, messageId: 'concrete', data: { className: className(node) } });
      }

      for (const member of node.body.body) {
        const what = defectOf(member);

        if (what !== undefined) {
          report({ node: member, messageId: 'member', data: { className: className(node), what } });
        }
      }
    };

    return {
      ClassDeclaration: judge,
      ClassExpression: judge,
      'ExportNamedDeclaration > TSInterfaceDeclaration': (node: TSESTree.TSInterfaceDeclaration) =>
        report({ node: node.id, messageId: 'interface', data: { name: node.id.name } }),
    };
  },
});

/** What a member is that a port cannot hold, in the words of a report. */
function defectOf(member: TSESTree.ClassElement): string | undefined {
  const name = memberName(member) ?? 'a computed member';

  if (member.type === AST_NODE_TYPES.MethodDefinition && member.kind === 'constructor') {
    return 'a constructor';
  }

  if (visibilityOf(member) !== 'public') {
    return `the ${visibilityOf(member)} member ${name}`;
  }

  return isAbstract(member) || isTokenKey(member) ? undefined : concreteMember(member, name);
}

function isAbstract(member: TSESTree.ClassElement): boolean {
  return (
    member.type === AST_NODE_TYPES.TSAbstractMethodDefinition ||
    member.type === AST_NODE_TYPES.TSAbstractPropertyDefinition
  );
}

function concreteMember(member: TSESTree.ClassElement, name: string): string {
  if (member.type === AST_NODE_TYPES.MethodDefinition) {
    return `the method ${name} with a body`;
  }

  return member.type === AST_NODE_TYPES.PropertyDefinition && member.value !== null
    ? `the property ${name} with an initializer`
    : `the member ${name} that is not abstract`;
}

/** `static readonly tokenKey = 'billing.PaymentGateway'`: the identity of a port loaded twice. */
function isTokenKey(member: TSESTree.ClassElement): boolean {
  if (
    member.type !== AST_NODE_TYPES.PropertyDefinition ||
    !member.static ||
    !member.readonly ||
    memberName(member) !== 'tokenKey'
  ) {
    return false;
  }

  return member.value !== null && staticString(member.value) !== undefined;
}
