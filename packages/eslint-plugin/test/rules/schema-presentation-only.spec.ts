import { schemaPresentationOnly } from '../../src/rules/schema-presentation-only.js';
import { at, BILLING, ruleTester, SAMPLE_CONFIG } from '../support/rule-tester.js';

const SHARED = { ...SAMPLE_CONFIG, stack: { schemas: 'shared' } };
const MONEY = "import type { Money } from '@/shared-kernel/presentation/money.schema';\nexport type Amount = Money;";
const VALIDATOR = "import { IsInt } from 'class-validator';\nexport class Money { @IsInt() cents = 0; }";

ruleTester.run('schema-presentation-only', schemaPresentationOnly, {
  valid: [
    at('src/shared-kernel/presentation/money.schema.ts', VALIDATOR, SHARED),
    at(`${BILLING}/presentation/http/invoices/issue-invoice/issue-invoice.mapper.ts`, MONEY, SHARED),
    at(`${BILLING}/test/unit/issue-invoice.handler.spec.ts`, MONEY, SHARED),
    at('src/platform/http/accepted.ts', MONEY, SHARED),
    at('src/shared-kernel/money.ts', VALIDATOR),
    at(`${BILLING}/application/commands/issue-invoice/issue-invoice.command.ts`, MONEY),
  ],
  invalid: [
    {
      ...at('src/shared-kernel/money.ts', VALIDATOR, SHARED),
      errors: [{ messageId: 'declaredInSharedKernel', data: { specifier: 'class-validator' } }],
    },
    {
      ...at(`${BILLING}/application/commands/issue-invoice/issue-invoice.command.ts`, MONEY, SHARED),
      errors: [{ messageId: 'readOutsidePresentation' }],
    },
    {
      ...at(`${BILLING}/domain/value-objects/amount.vo.ts`, MONEY, SHARED),
      errors: [{ messageId: 'readOutsidePresentation' }],
    },
    {
      ...at('src/shared-kernel/amount.ts', MONEY, SHARED),
      errors: [{ messageId: 'readOutsidePresentation' }],
    },
  ],
});
