import { cleanNoMagicNumber } from '../../src/rules/clean-no-magic-number.js';
import { at, BILLING, ruleTester } from '../support/rule-tester.js';

const DOMAIN = `${BILLING}/domain/value-objects/range.vo.ts`;
const HANDLER = `${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`;

ruleTester.run('clean-no-magic-number', cleanNoMagicNumber, {
  valid: [
    at(DOMAIN, 'const MINUTES_PER_HOUR = 60;\nexport const minutes = (hours: number) => hours * MINUTES_PER_HOUR;'),
    at(DOMAIN, 'export const LIMITS = { longest: 254, shortest: [2, 3] } as const;'),
    at(DOMAIN, 'export class Range { private static readonly END_OF_DAY = 24 * 60; }'),
    at(
      DOMAIN,
      'export const first = (items: string[]) => items[0] ?? items[2];\nexport const none = (n: number) => n === 0 || n - 1 === -1;',
    ),
    at(DOMAIN, 'type Pair = [1, 2];\nexport type Hour = 7 | 8;\nenum Level { Low = 3 }'),
    at(`${BILLING}/infrastructure/persistence/invoice.mapper.ts`, 'export const page = () => 50;'),
    at(`${BILLING}/test/unit/range.vo.spec.ts`, 'export const at = () => 42;'),
    at('src/platform/http/server.ts', 'export const port = () => 3000;'),
  ],
  invalid: [
    {
      ...at(DOMAIN, 'export const minutes = (hours: number) => hours * 60;'),
      errors: [{ messageId: 'magic', data: { value: '60', allowed: '0, 1, -1' } }],
    },
    {
      ...at(
        HANDLER,
        'export class Handler {\n  execute(): number {\n    const limit = 100;\n\n    return -5 + limit;\n  }\n}',
      ),
      errors: [{ messageId: 'magic' }, { messageId: 'magic' }],
    },
    {
      ...at(
        DOMAIN,
        'export class Range { private readonly width = 3; }\nlet later = 4;\nexport const big = () => 10n;',
      ),
      errors: [{ messageId: 'magic' }, { messageId: 'magic' }, { messageId: 'magic' }],
    },
    {
      ...at(DOMAIN, 'export const half = (n: number) => n / 2 + n * 3;'),
      options: [{ allow: [0, 2] }],
      errors: [{ messageId: 'magic', data: { value: '3', allowed: '0, 2' } }],
    },
  ],
});
