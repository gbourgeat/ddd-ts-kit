import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { className } from '../support/classes/class-name.js';
import { enclosingMember } from '../support/classes/enclosing-member.js';
import { memberName } from '../support/classes/member-name.js';
import { isAggregateFile } from '../support/event-sourcing/is-aggregate-file.js';
import { isEventSourcedClass } from '../support/event-sourcing/is-event-sourced-class.js';
import { propertyName } from '../support/globals/property-name.js';
import { startsAtThis } from '../support/members/starts-at-this.js';
import { defineRule, type Report } from '../support/rule/define-rule.js';

const MUTATORS = new Set([
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse',
  'fill',
  'copyWithin',
  'set',
  'add',
  'delete',
  'clear',
]);

const APPLY = /^apply[A-Z]/;

interface Judged {
  readonly method: string;
  readonly owner: string;
  readonly applies: boolean;
}

type MessageId = 'outsideApply' | 'recordedInApply';

export const eventSourcingStateInApply = defineRule<MessageId>({
  id: 'event-sourcing/state-in-apply',
  type: 'problem',
  recommended: 'error',
  description:
    'An event-sourced aggregate changes its state only in its apply methods (`apply<Fact>`, `restore` for a snapshot), and an apply method records no event.',
  messages: {
    outsideApply:
      '{{method}} of the event-sourced aggregate {{className}} writes {{target}} outside an apply method. Record the event of what the command decided, `this.record(new <Fact>(...))`, and change the state in `apply<Fact>(event)`: a replay rebuilds only what the apply methods write.',
    recordedInApply:
      'The apply method {{method}} of {{className}} records an event: a replay would record it again. Record the follow-up fact from the command that decides it.',
  },
  create({ file, sourceCode, report }) {
    if (!isAggregateFile(file)) {
      return {};
    }

    const written = (node: TSESTree.Node, target: TSESTree.Node): void => {
      const judged = judgedAt(node);

      if (judged !== undefined && !judged.applies && startsAtThis(target)) {
        const data = { method: judged.method, className: judged.owner, target: sourceCode.getText(target) };

        report({ node, messageId: 'outsideApply', data });
      }
    };

    return {
      AssignmentExpression: (node) => written(node, node.left),
      UpdateExpression: (node) => written(node, node.argument),
      CallExpression: (node) => called(node, written, report),
    };
  },
});

/** A mutating call writes what it is called on; `this.record(..)` in an apply method records again at each replay. */
function called(
  node: TSESTree.CallExpression,
  written: (node: TSESTree.Node, target: TSESTree.Node) => void,
  report: Report<MessageId>,
): void {
  if (node.callee.type !== AST_NODE_TYPES.MemberExpression) {
    return;
  }

  const name = propertyName(node.callee) ?? '';

  if (MUTATORS.has(name)) {
    written(node, node.callee.object);
  }

  const judged = judgedAt(node);

  if (name === 'record' && node.callee.object.type === AST_NODE_TYPES.ThisExpression && judged?.applies === true) {
    report({ node, messageId: 'recordedInApply', data: { method: judged.method, className: judged.owner } });
  }
}

/** The method of an event-sourced class around the node, unless it is the constructor or a static method. */
function judgedAt(node: TSESTree.Node): Judged | undefined {
  const site = enclosingMember(node);

  if (site === undefined || !isEventSourcedClass(site.body.parent)) {
    return undefined;
  }

  const { member } = site;
  const isMethod = member.type === AST_NODE_TYPES.MethodDefinition;

  if (!isMethod || member.static || member.kind === 'constructor') {
    return undefined;
  }

  const method = memberName(member) ?? '';

  return { method, owner: className(site.body.parent), applies: APPLY.test(method) || method === 'restore' };
}
