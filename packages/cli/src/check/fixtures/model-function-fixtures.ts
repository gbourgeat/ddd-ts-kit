import type { Fixture } from './fixture.js';
import { PATHS } from './paths.js';
import { project } from './project.js';
import { SAMPLES } from './samples.js';
import { VALUE_FILES, VALUES } from './value-object-files.js';

const { RULE, SERVICE, SHARED_PLAIN, PLAIN } = VALUES;
const { classes, service } = VALUE_FILES;
const { BILLING } = PATHS;

const passing = (name: string, files: Fixture['files']): Fixture => ({ ruleId: RULE, name, expect: 'pass', files });

const failing = (name: string, content: string): Fixture => ({
  ruleId: RULE,
  name,
  expect: { file: SERVICE },
  files: classes(service(content)),
});

const MACHINE = `${BILLING}/domain/state-machines/invoice.state-machine.ts`;

/** What `domain/value-object-class` says of the functions of `domain/` and of the shared kernel. */
export const MODEL_FUNCTION_FIXTURES: readonly Fixture[] = [
  passing(
    'domain functions that answer a value object, a boolean, or a plain object only inside a callback',
    classes(
      service(
        'export function invoiceTotal(lines: readonly Money[]): Money {\n  const rows = lines.map((line) => {\n    return { line, cents: 0 };\n  });\n\n  return rows.reduce((sum, { line }) => sum.add(line), Money.of(0));\n}\n',
      ),
    ),
  ),
  passing(
    'a specification answering an object of functions, literal or built from local closures',
    classes(
      service(
        'export const invoiceTotal = (floor: Money) => {\n  const isSatisfiedBy = (total: Money): boolean => total.equals(floor);\n\n  return {\n    isSatisfiedBy,\n    describe(): string {\n      return String(floor);\n    },\n  };\n};\n',
      ),
    ),
  ),
  passing(
    'a function that takes value objects and answers a record of value objects it builds',
    classes(
      service('export const invoiceTotal = (total: Money) => ({ first: Money.of(1), rest: total.add(total) });\n'),
    ),
  ),
  passing(
    'a function that derives a record from another with a spread, as a reducer does',
    classes(
      service(
        'type InvoiceState = { readonly status: string };\n\nexport const invoiceTotal = (state: InvoiceState, status: string): InvoiceState => ({ ...state, status });\n',
      ),
    ),
  ),
  passing(
    'a state machine declaration and a domain service class whose method answers an object',
    classes({
      [MACHINE]:
        "import { defineStateMachine } from '@ddd-ts-kit/kernel';\n\nexport const invoiceLifecycle = defineStateMachine({\n  states: ['draft', 'issued'],\n  initial: ['draft'],\n  transitions: { issue: { from: ['draft'], to: 'issued' } },\n  refused: () => ({ code: 'REFUSED' }),\n});\n",
      [`${BILLING}/test/unit/invoice.state-machine.spec.ts`]: SAMPLES.SPEC,
      [`${BILLING}/domain/services/invoice-issue.service.ts`]:
        'export class InvoiceIssueService {\n  issue(): { cents: number } {\n    return { cents: 0 };\n  }\n}\n',
      [`${BILLING}/test/unit/invoice-issue.service.spec.ts`]: SAMPLES.SPEC,
    }),
  ),
  passing(
    'a spec and a presentation file of the shared kernel, outside the model, may build a plain object',
    classes({
      [`${BILLING}/test/unit/money.spec.ts`]: `import { it } from 'vitest';\n\n${PLAIN}\nit('builds', () => money(1, 'EUR'));\n`,
      'src/shared-kernel/presentation/money.ts': PLAIN,
    }),
  ),
  passing(
    'a helper of the shared kernel that answers a type of a package',
    classes({
      'src/shared-kernel/storable-stamp.ts':
        "import type { EventStamp } from '@ddd-ts-kit/kernel';\n\nexport function storableStamp(stamp: EventStamp): EventStamp {\n  return { eventId: stamp.eventId, occurredAt: new Date(0), version: 1 };\n}\n",
    }),
  ),
  passing(
    'a domain function written as a value, in a project whose config does not say "values"',
    project(service(PLAIN)),
  ),
  failing(
    'a domain function that builds a plain object',
    'export function invoiceTotal(lines: readonly Money[], currency: string) {\n  const cents = Math.round(lines.length);\n\n  return { cents, currency };\n}\n',
  ),
  failing(
    'a domain arrow function that answers a plain object',
    'export const invoiceTotal = (line: Money, currency: string) => ({ line, currency });\n',
  ),
  failing(
    'a domain constant bound to a function expression that builds a plain object',
    'export const invoiceTotal = function (cents: number) {\n  return { cents, currency: 0 };\n};\n',
  ),
  failing(
    'a generic domain arrow function that answers a plain object',
    'export const invoiceTotal = <T,>(cents: T) => ({ cents, currency: 0 });\n',
  ),
  failing(
    'a domain function exported by an export list',
    'export { invoiceTotal };\n\nfunction invoiceTotal(cents: number, currency: string) {\n  return { cents, currency };\n}\n',
  ),
  failing(
    'a domain arrow function exported by an export list',
    'const invoiceTotal = (cents: number, currency: string) => ({ cents, currency });\n\nexport { invoiceTotal };\n',
  ),
  failing(
    'a domain arrow function exported by default',
    'export default (cents: number) => ({ cents, currency: 0 });\n',
  ),
  failing(
    'a decision answered as a plain record',
    "export const invoiceTotal = (reason: string) => {\n  return { kind: 'refused' as const, reason };\n};\n",
  ),
  failing(
    'a value written as a record of data and closures',
    'export const invoiceTotal = (cents: number) => ({ cents, doubled: (): number => cents * 2 });\n',
  ),
  {
    ruleId: RULE,
    name: 'a value of the shared kernel written as a function in a file not named *.vo.ts',
    expect: { file: SHARED_PLAIN },
    files: classes({ [SHARED_PLAIN]: PLAIN }),
  },
];
