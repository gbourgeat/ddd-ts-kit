import type { Injection } from '../injection';
import { PATHS } from '../paths';

const { HANDLER_SPEC, VALUE_OBJECT_SPEC } = PATHS;

const WITHDRAWS = "  it('withdraws the planned reminder of the appointment', async () => {\n";
const OTHERS_PLANNED = "    expect((await reminderRepository.findById('reminder-2'))?.status).toBe('planned');\n";

const UNKNOWN_KIND =
  "    expectRefusal(() => NotificationKind.create('newsletter'), 'INVALID_NOTIFICATION_KIND', { given: 'newsletter' });\n";

const ACCEPTS_KIND = '    expect(NotificationKind.create(kind).value).toBe(kind);\n';

/** The shape of a test: what it is named, what it holds, what it asserts and how. ESLint alone reads it. */
export const TEST_INJECTIONS: readonly Injection[] = [
  {
    rule: 'test/no-only-no-skip',
    what: 'a test focused with .only',
    file: HANDLER_SPEC,
    changes: [{ file: HANDLER_SPEC, from: WITHDRAWS, to: WITHDRAWS.replace('  it(', '  it.only(') }],
    checker: false,
    eslint: 'ddd-ts-kit/test-no-only-no-skip',
  },
  {
    rule: 'test/title-states-a-rule',
    what: 'a test titled with should',
    file: HANDLER_SPEC,
    changes: [{ file: HANDLER_SPEC, from: WITHDRAWS, to: WITHDRAWS.replace("'withdraws", "'should withdraw") }],
    checker: false,
    eslint: 'ddd-ts-kit/test-title-states-a-rule',
  },
  {
    rule: 'test/no-logic',
    what: 'an assertion under an if',
    file: HANDLER_SPEC,
    changes: [
      {
        file: HANDLER_SPEC,
        from: OTHERS_PLANNED,
        to: `    if (reminderRepository.count() > 1) {\n  ${OTHERS_PLANNED}    }\n`,
      },
    ],
    checker: false,
    eslint: 'ddd-ts-kit/test-no-logic',
  },
  {
    rule: 'test/assertion-present',
    what: 'a test that executes the command and asserts nothing',
    file: HANDLER_SPEC,
    changes: [{ file: HANDLER_SPEC, from: `\n${OTHERS_PLANNED}`, to: '' }],
    checker: false,
    eslint: 'ddd-ts-kit/test-assertion-present',
  },
  {
    rule: 'test/refusal-by-code',
    what: 'a refusal asserted by its message',
    file: VALUE_OBJECT_SPEC,
    changes: [
      {
        file: VALUE_OBJECT_SPEC,
        from: UNKNOWN_KIND,
        to: "    expect(() => NotificationKind.create('newsletter')).toThrow('newsletter');\n",
      },
    ],
    checker: false,
    eslint: 'ddd-ts-kit/test-refusal-by-code',
  },
  {
    rule: 'test/no-snapshot',
    what: 'a value object compared with a snapshot',
    file: VALUE_OBJECT_SPEC,
    changes: [
      {
        file: VALUE_OBJECT_SPEC,
        from: ACCEPTS_KIND,
        to: '    expect(NotificationKind.create(kind)).toMatchSnapshot();\n',
      },
    ],
    checker: false,
    eslint: 'ddd-ts-kit/test-no-snapshot',
  },
];
