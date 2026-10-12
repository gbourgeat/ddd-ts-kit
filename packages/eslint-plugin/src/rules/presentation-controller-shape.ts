import type { TSESTree } from '@typescript-eslint/utils';
import { className } from '../support/classes/class-name.js';
import { exportedClasses } from '../support/classes/exported-classes.js';
import { isCallable } from '../support/classes/is-callable.js';
import { memberName } from '../support/classes/member-name.js';
import { visibilityOf } from '../support/classes/visibility-of.js';
import { declarationReader } from '../support/declarations/declaration-reader.js';
import { defineRule, type Report } from '../support/rule/define-rule.js';

type MessageId = 'severalClasses' | 'missingHandle' | 'extraPublicMethod';

export const presentationControllerShape = defineRule<MessageId>({
  id: 'presentation/controller-shape',
  type: 'problem',
  recommended: 'error',
  description:
    'A `*.controller.ts` file whose class carries `@Controller` of `@ddd-ts-kit/http` exports that one class, whose single public method is `handle`: one class per route.',
  messages: {
    severalClasses:
      'This controller file also exports {{className}}. One class answers one route: move {{className}} to its own folder under presentation/http/, next to its own schemas.',
    missingHandle:
      '{{className}} carries @Controller and has no public `handle` method. The pipeline calls a controller through `handle(request)`: name its entry point that way.',
    extraPublicMethod:
      '{{className}} exposes {{name}} besides `handle`. Make it private if it is a step of the answer, move it to the request mapper or the serializer of the route if it translates, or to the use case if it decides: a controller has one entry point.',
  },
  create({ file, report }) {
    if (file.isTest || !file.path.endsWith('.controller.ts')) {
      return {};
    }

    return { Program: (program) => judgeControllerFile(program, report) };
  },
});

function judgeControllerFile(program: TSESTree.Program, report: Report<MessageId>): void {
  const read = declarationReader(program);
  const classes = exportedClasses(program);
  const controller = classes.find((candidate) => read(candidate).some(({ name }) => name === 'Controller'));

  // A file that declares no controller of the kit (a controller of NestJS, written by hand) is not judged.
  if (controller === undefined) {
    return;
  }

  for (const other of classes.filter((candidate) => candidate !== controller)) {
    report({ node: other.id ?? other, messageId: 'severalClasses', data: { className: className(other) } });
  }

  const owner = className(controller);

  const publicMethods = controller.body.body.filter(
    (member) => isCallable(member) && visibilityOf(member) === 'public',
  );

  if (!publicMethods.some((member) => memberName(member) === 'handle')) {
    report({ node: controller.id ?? controller, messageId: 'missingHandle', data: { className: owner } });
  }

  for (const member of publicMethods.filter((candidate) => memberName(candidate) !== 'handle')) {
    report({
      node: member,
      messageId: 'extraPublicMethod',
      data: { className: owner, name: memberName(member) ?? 'a computed method' },
    });
  }
}
