import { cleanNoNoiseComment } from '../../src/rules/clean-no-noise-comment.js';
import { ruleTester } from '../support/rule-tester.js';

ruleTester.run('clean-no-noise-comment', cleanNoNoiseComment, {
  valid: [
    '// The vendor rounds half up (contract 4.2), so we round before summing.\nconst total = 1;',
    '/** Posix path relative to the project root. */\nconst path = 1;',
    '// TODO(domain): decide what "issue invoice" does.\nconst total = 1;',
    '// TODO: retry with backoff, see #142\nconst total = 1;',
    '/**\n * @param amount in cents, never negative\n * @returns the amount with tax\n */\nfunction addTax(amount: number): number { return amount; }',
    'if (ready) {\n  run();\n} // only when the outbox is empty, otherwise the relay runs twice',
    '// eslint-disable-next-line no-console -- the CLI prints\nconsole.log(1);',
    '/**\n * @example\n * // ----------\n */\nconst total = 1;',
    '/** The invoices that are overdue at the given instant, oldest first. */\nfunction overdueInvoices(): void {}',
    'class Invoice {\n  /** Raised when the same invoice is issued twice. */\n  issue(): void {}\n}',
    '// get the invoice\n\nconst unrelated = 1;',
  ],
  invalid: [
    { code: '// ---------- helpers ----------\nconst total = 1;', errors: [{ messageId: 'banner' }] },
    { code: '/* ============ */\nconst total = 1;', errors: [{ messageId: 'banner' }] },
    { code: 'if (ready) {\n  run();\n} // end if', errors: [{ messageId: 'closingBrace' }] },
    { code: 'function run(): void {\n} // function run', errors: [{ messageId: 'closingBrace' }] },
    { code: '/**\n * @author Jane\n */\nconst total = 1;', errors: [{ messageId: 'journal' }] },
    { code: '// 2024-03-01 changed the rounding\nconst total = 1;', errors: [{ messageId: 'journal' }] },
    { code: '/**\n * Adds the tax of the country.\n * @param amount\n * @returns\n */\nfunction addTax(amount: number): number { return amount; }', errors: [{ messageId: 'emptyTag', line: 3 }, { messageId: 'emptyTag', line: 4 }] },
    { code: '// TODO fix this\nconst total = 1;', errors: [{ messageId: 'ownerlessTodo' }] },
    { code: '/** The invoice repository. */\nexport class InvoiceRepository {}', errors: [{ messageId: 'restatesName', data: { name: 'InvoiceRepository', excerpt: 'The invoice repository.' } }] },
    { code: 'class Invoice {\n  // the total\n  private readonly total = 0;\n}', errors: [{ messageId: 'restatesName', data: { name: 'total', excerpt: 'the total' } }] },
    { code: 'class Invoice {\n  /** Gets the id. */\n  get id(): string { return ""; }\n}', errors: [{ messageId: 'restatesName', data: { name: 'id', excerpt: 'Gets the id.' } }] },
    { code: 'class Invoice {\n  /**\n   * Issues the invoice.\n   */\n  issueInvoice(): void {}\n}', errors: [{ messageId: 'restatesName', data: { name: 'issueInvoice', excerpt: 'Issues the invoice.' } }] },
    { code: '// creates\n// an invoice\nexport function createInvoice(): void {}', errors: [{ messageId: 'restatesName', line: 1 }] },
    { code: 'class Invoice {\n  // the secret\n  #secret = 1;\n}', errors: [{ messageId: 'restatesName', data: { name: '#secret', excerpt: 'the secret' } }] },
    { code: 'class Cache {\n  /** Gets the value. */\n  get(): void {}\n}', errors: [{ messageId: 'restatesName', data: { name: 'get', excerpt: 'Gets the value.' } }] },
  ],
});
