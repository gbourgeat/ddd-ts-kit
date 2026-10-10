import type { TSESTree } from '@typescript-eslint/utils';
import { className } from '../support/classes/class-name.js';
import { exportedClasses } from '../support/classes/exported-classes.js';
import { isCallable } from '../support/classes/is-callable.js';
import { memberName } from '../support/classes/member-name.js';
import { visibilityOf } from '../support/classes/visibility-of.js';
import { defineRule, type Report } from '../support/rule/define-rule.js';

type MessageId = 'noHandler' | 'severalClasses' | 'missingExecute' | 'extraPublicMethod';

export const applicationHandlerShape = defineRule<MessageId>({
  id: 'application/handler-shape',
  type: 'problem',
  recommended: 'error',
  description: 'A `*.handler.ts` file exports exactly one class whose single public method is `execute`.',
  messages: {
    noHandler:
      'This handler file exports no class. Export one class named after the use case, with a single public method `execute`.',
    severalClasses:
      'This handler file also exports {{className}}. Keep one handler per file: move {{className}} to its own use case folder.',
    missingExecute:
      '{{className}} has no public `execute` method. A handler is called by the bus through `execute(command)` or `execute(query)`: name its entry point that way.',
    extraPublicMethod:
      '{{className}} exposes {{name}} besides `execute`. Make it private if it is a step of the use case, or move it to the domain if it is a business decision: a handler has one entry point.',
  },
  create({ file, report }) {
    const { location } = file;

    if (
      location.area !== 'context' ||
      location.layer !== 'application' ||
      file.isTest ||
      !file.path.endsWith('.handler.ts')
    ) {
      return {};
    }

    return { Program: (program) => judgeHandlerFile(program, report) };
  },
});

function judgeHandlerFile(program: TSESTree.Program, report: Report<MessageId>): void {
  const [handler, ...others] = exportedClasses(program);

  if (handler === undefined) {
    report({ loc: { line: 1, column: 0 }, messageId: 'noHandler' });

    return;
  }

  for (const other of others) {
    report({ node: other.id ?? other, messageId: 'severalClasses', data: { className: className(other) } });
  }

  const publicMethods = handler.body.body.filter((member) => isCallable(member) && visibilityOf(member) === 'public');
  const owner = className(handler);

  if (!publicMethods.some((member) => memberName(member) === 'execute')) {
    report({ node: handler.id ?? handler, messageId: 'missingExecute', data: { className: owner } });
  }

  for (const member of publicMethods.filter((candidate) => memberName(candidate) !== 'execute')) {
    report({
      node: member,
      messageId: 'extraPublicMethod',
      data: { className: owner, name: memberName(member) ?? 'a computed method' },
    });
  }
}
