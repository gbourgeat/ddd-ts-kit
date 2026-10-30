import { TSESLint } from '@typescript-eslint/utils';
import { describe, expect, it } from 'vitest';
import { plugin } from '../../src/plugin';
import { BILLING, SAMPLE_CONFIG } from '../support/rule-tester';

const HANDLER = `${BILLING}/application/commands/cancel-invoice/cancel-invoice.handler.ts`;

/** The default parser of ESLint hands the rule no type information: the rule then reads the names of the code. */
function findings(code: string): string[] {
  const linter = new TSESLint.Linter({ configType: 'flat' });

  return linter
    .verify(
      code,
      [
        {
          files: ['**/*.ts'],
          plugins: { 'ddd-ts-kit': plugin },
          rules: { 'ddd-ts-kit/naming-business-name': 'error' },
          settings: { 'ddd-ts-kit': { config: SAMPLE_CONFIG, filename: HANDLER } },
        },
      ],
      HANDLER,
    )
    .map((message) => message.message);
}

describe('naming-business-name under the default parser of ESLint', () => {
  it('names a variable after the repository it reads, by the convention of the kit, without types', () => {
    const code = 'function cancel(id) {\n  const target = invoiceRepository.findById(id);\n\n  target.cancel();\n}\n';

    expect(findings(code)).toEqual([expect.stringContaining('Name it `invoice`')]);
  });
});
