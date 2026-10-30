import { describe, expect, it } from 'vitest';
import { cli, read } from './helpers';
import { initProject } from './support/init-project';

const READER = 'src/contexts/billing/infrastructure/persistence/in-memory-get-invoice-reader.repository.ts';
const FAKE = 'src/contexts/billing/test/fakes/get-invoice-reader.fake.ts';

describe('generate query', () => {
  it('writes a fake that runs the adapter, so the handler spec covers the read it generated', () => {
    const root = initProject('--context', 'billing:core');

    cli(root, 'generate', 'aggregate', 'billing', 'Invoice', '--term', 'Invoice=x');

    const result = cli(
      root,
      'generate',
      'query',
      'billing',
      'GetInvoice',
      '--permission',
      'invoice.read',
      '--term',
      'Get=x',
      '--term',
      'Read=x',
    );

    expect(result.code).toBe(0);
    expect(read(root, FAKE)).toContain('export class FakeGetInvoiceReader extends InMemoryGetInvoiceReader {');
    expect(read(root, FAKE)).not.toContain('async read(');
    expect(read(root, READER)).toContain('protected readonly answer: GetInvoiceResult = {};');
  });
});
