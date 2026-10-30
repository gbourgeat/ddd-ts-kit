import { cleanNoMagicNumber } from '../../src/rules/clean-no-magic-number';
import { at, BILLING, ruleTester, SAMPLE_CONFIG } from '../support/rule-tester';

const DOMAIN = `${BILLING}/domain/value-objects/range.vo.ts`;
const HANDLER = `${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`;

/** A project that names its numbers, as `init` writes it. */
const named = (file: string, code: string) => at(file, code, { ...SAMPLE_CONFIG, stack: { literals: 'named' } });

ruleTester.run('clean-no-magic-number', cleanNoMagicNumber, {
  valid: [
    at(DOMAIN, 'export const minutes = (hours: number) => hours * 60;'),
    named(DOMAIN, 'const MINUTES_PER_HOUR = 60;\nexport const minutes = (hours: number) => hours * MINUTES_PER_HOUR;'),
    named(DOMAIN, 'export const LIMITS = { longest: 254, shortest: [2, 3] } as const;'),
    named(DOMAIN, 'export class Range { private static readonly END_OF_DAY = 24 * 60; }'),
    named(
      DOMAIN,
      'export const first = (items: string[]) => items[0] ?? items[2];\nexport const none = (n: number) => n === 0 || n - 1 === -1;',
    ),
    named(DOMAIN, 'type Pair = [1, 2];\nexport type Hour = 7 | 8;\nenum Level { Low = 3 }'),
    named(DOMAIN, "export const CURRENCY = 'EUR';\nexport const PAID = true;"),
    named(`${BILLING}/infrastructure/persistence/invoice.mapper.ts`, 'export const page = () => 50;'),
    named(`${BILLING}/test/unit/range.vo.spec.ts`, 'export const at = () => 42;'),
    named('src/platform/http/server.ts', 'export const port = () => 3000;'),
  ],
  invalid: [
    {
      ...named(DOMAIN, 'export const minutes = (hours: number) => hours * 60;'),
      errors: [{ messageId: 'magic', data: { value: '60', allowed: '0, 1, -1' } }],
    },
    {
      ...named(
        HANDLER,
        'export class Handler {\n  execute(): number {\n    const limit = 100;\n\n    return -5 + limit;\n  }\n}',
      ),
      errors: [{ messageId: 'magic' }, { messageId: 'magic' }],
    },
    {
      ...named(
        DOMAIN,
        'export class Range { private readonly width = 3; }\nlet later = 4;\nexport const big = () => 10n;',
      ),
      errors: [{ messageId: 'magic' }, { messageId: 'magic' }, { messageId: 'magic' }],
    },
    {
      ...named(DOMAIN, 'export const half = (n: number) => n / 2 + n * 3;'),
      options: [{ allow: [0, 2] }],
      errors: [{ messageId: 'magic', data: { value: '3', allowed: '0, 2' } }],
    },
  ],
});
