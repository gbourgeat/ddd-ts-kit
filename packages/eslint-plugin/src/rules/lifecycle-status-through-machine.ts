import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import type { LintedFile } from '../project/linted-file.js';
import { className } from '../support/classes/class-name.js';
import { enclosingMember } from '../support/classes/enclosing-member.js';
import { defineRule } from '../support/rule/define-rule.js';

const STATUS = 'status';
const MACHINE_FILE = /(?:^|\/)state-machines\/[^/]+\.state-machine(?:\.[cm]?[jt]s)?$/;
const THROUGH = new Set(['next', 'start']);

type MessageId = 'notThroughMachine';

export const lifecycleStatusThroughMachine = defineRule<MessageId>({
  id: 'lifecycle/status-through-machine',
  type: 'problem',
  recommended: 'error',
  description:
    'In an aggregate that imports its state machine, the status is written only from the machine (`machine.next(...)`, `machine.start(...)`) or copied from a status already read.',
  messages: {
    notThroughMachine:
      "{{className}} writes its status without its state machine ({{value}}). Ask the machine: `status: {{machine}}.next(this.state.status, '<transition>')`, so that a forbidden transition is refused in one place.",
  },
  create({ file, sourceCode, report }) {
    if (!isAggregateFile(file)) {
      return {};
    }

    const machines = new Set<string>();

    const judge = (node: TSESTree.Node, value: TSESTree.Node): void => {
      const site = enclosingMember(node);
      const machine = [...machines][0];

      if (site === undefined || machine === undefined || isThroughMachine(value, machines)) {
        return;
      }

      const data = { className: className(site.body.parent), value: sourceCode.getText(value), machine };

      report({ node: value, messageId: 'notThroughMachine', data });
    };

    return {
      ImportDeclaration(node) {
        if (MACHINE_FILE.test(node.source.value)) {
          node.specifiers.forEach((specifier) => machines.add(specifier.local.name));
        }
      },
      Property(node) {
        if (node.parent.type === AST_NODE_TYPES.ObjectExpression && !node.shorthand && keyIsStatus(node.key)) {
          judge(node, node.value);
        }
      },
      AssignmentExpression(node) {
        if (node.left.type === AST_NODE_TYPES.MemberExpression && keyIsStatus(node.left.property)) {
          judge(node, node.right);
        }
      },
    };
  },
});

function isAggregateFile(file: LintedFile): boolean {
  const { location } = file;

  return (
    location.area === 'context' && location.layer === 'domain' && !file.isTest && location.inside[0] === 'aggregates'
  );
}

function keyIsStatus(key: TSESTree.Node): boolean {
  return (
    (key.type === AST_NODE_TYPES.Identifier && key.name === STATUS) ||
    (key.type === AST_NODE_TYPES.Literal && key.value === STATUS)
  );
}

/** A call of the machine, or a status copied from one already read (`this.state.status`, `status`). */
function isThroughMachine(value: TSESTree.Node, machines: ReadonlySet<string>): boolean {
  if (value.type === AST_NODE_TYPES.Identifier) {
    return value.name === STATUS;
  }

  if (value.type === AST_NODE_TYPES.MemberExpression) {
    return keyIsStatus(value.property);
  }

  if (value.type !== AST_NODE_TYPES.CallExpression || value.callee.type !== AST_NODE_TYPES.MemberExpression) {
    return false;
  }

  const { object, property } = value.callee;

  return (
    object.type === AST_NODE_TYPES.Identifier &&
    machines.has(object.name) &&
    property.type === AST_NODE_TYPES.Identifier &&
    THROUGH.has(property.name)
  );
}
