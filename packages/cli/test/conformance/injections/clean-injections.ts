import type { Injection } from '../injection.js';
import { PATHS } from '../paths.js';

const { AGGREGATE, DUE_HANDLER, EVENT_HANDLER, HANDLER, POLICY, QUERY_HANDLER, ROUTE, SEND_HANDLER } = PATHS;
const WITHDRAWN = '    this.state = { ...this.state, status: ReminderStatus.Withdrawn };\n';
const GUARD = '    if (reminder === undefined) {\n      return;\n    }\n';

const TO_LINE = `function toLine(notification: SearchNotificationsItem): SearchNotificationsLine {
  return {
    id: notification.id,
    kind: notification.kind,
    appointmentId: notification.appointmentId,
    startsAt: notification.startsAt.toISOString(),
    sentAt: notification.sentAt.toISOString(),
  };
}
`;

/** Clean code: what a file shows on its own, held by the checker and by ESLint, and the layout the formatter holds. */
export const CLEAN_INJECTIONS: readonly Injection[] = [
  {
    rule: 'clean/stepdown',
    what: 'a helper written above the function that calls it',
    file: ROUTE,
    changes: [
      { file: ROUTE, from: `\n${TO_LINE}`, to: '' },
      {
        file: ROUTE,
        from: '@Controller({',
        to: `${TO_LINE}\n@Controller({`,
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/clean-stepdown',
  },
  {
    rule: 'clean/function-size',
    what: 'a method of more than 30 lines',
    file: AGGREGATE,
    changes: [{ file: AGGREGATE, from: WITHDRAWN, to: WITHDRAWN.repeat(31) }],
    checker: true,
    eslint: 'ddd-ts-kit/clean-function-size',
  },
  {
    rule: 'clean/no-commented-out-code',
    what: 'a statement left in a comment',
    file: HANDLER,
    changes: [
      {
        file: HANDLER,
        from: '    reminder.withdraw();\n',
        to: '    // reminder.expire(command.at);\n    reminder.withdraw();\n',
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/clean-no-commented-out-code',
  },
  {
    rule: 'clean/no-noise-comment',
    what: 'a banner comment',
    file: DUE_HANDLER,
    changes: [
      {
        file: DUE_HANDLER,
        from: '      reminder.send(command.asOf);\n',
        to: '      // ---------- sending ----------\n      reminder.send(command.asOf);\n',
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/clean-no-noise-comment',
  },
  {
    rule: 'clean/no-escape-hatch',
    what: 'a non-null assertion in place of the guard',
    file: HANDLER,
    changes: [
      { file: HANDLER, from: `${GUARD}\n`, to: '' },
      { file: HANDLER, from: '    reminder.withdraw();', to: '    reminder!.withdraw();' },
      { file: HANDLER, from: 'save(reminder);', to: 'save(reminder!);' },
    ],
    checker: true,
    eslint: '@typescript-eslint/no-non-null-assertion',
  },
  {
    rule: 'clean/no-flag-argument',
    what: 'a boolean parameter on a public method of an aggregate',
    file: AGGREGATE,
    changes: [
      {
        file: AGGREGATE,
        from: '  withdraw(): void {\n    if (this.state.status',
        to: '  withdraw(force: boolean): void {\n    if (!force && this.state.status',
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/clean-no-flag-argument',
  },
  {
    rule: 'clean/no-hash-private',
    what: 'a #private member',
    file: EVENT_HANDLER,
    changes: [
      { file: EVENT_HANDLER, from: '  readonly actor = systemActor(', to: '  readonly #actor = systemActor(' },
      {
        file: EVENT_HANDLER,
        from: 'new SendNotificationCommand(this.actor,',
        to: 'new SendNotificationCommand(this.#actor,',
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/clean-no-hash-private',
  },
  {
    rule: 'clean/blank-lines',
    what: 'a return glued to the statement above it',
    file: QUERY_HANDLER,
    changes: [{ file: QUERY_HANDLER, from: "'person');\n\n    return", to: "'person');\n    return" }],
    checker: true,
    eslint: '@stylistic/padding-line-between-statements',
  },
  {
    rule: 'clean/no-magic-number',
    what: 'a notice doubled by a number without a name in the aggregate',
    file: AGGREGATE,
    changes: [{ file: AGGREGATE, from: 'getTime() - NOTICE_MS);', to: 'getTime() - NOTICE_MS * 2);' }],
    checker: false,
    eslint: 'ddd-ts-kit/clean-no-magic-number',
  },
  {
    rule: 'clean/braces',
    what: 'an if without braces',
    file: HANDLER,
    changes: [{ file: HANDLER, from: GUARD, to: '    if (reminder === undefined) return;\n' }],
    checker: true,
    eslint: 'curly',
  },
  {
    rule: 'clean/formatted',
    what: 'a file the formatter would lay out otherwise',
    file: SEND_HANDLER,
    changes: [
      {
        file: SEND_HANDLER,
        from: "from '@ddd-ts-kit/kernel/declarations';",
        to: 'from "@ddd-ts-kit/kernel/declarations"',
      },
    ],
    checker: false,
    formatter: true,
  },
  {
    rule: 'clean/one-export-per-file',
    what: 'a second exported function in a file named after the first',
    file: POLICY,
    changes: [{ file: POLICY, where: 'end', to: '\nexport function noPolicy(): readonly [] {\n  return [];\n}\n' }],
    checker: true,
    eslint: 'ddd-ts-kit/clean-one-export-per-file',
  },
  {
    rule: 'clean/file-size',
    what: 'a file of more than 350 lines',
    file: POLICY,
    changes: [{ file: POLICY, where: 'end', to: `\n${'void 0;\n'.repeat(350)}` }],
    checker: true,
    eslint: 'ddd-ts-kit/clean-file-size',
  },
];
