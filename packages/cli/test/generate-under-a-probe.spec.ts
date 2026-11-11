import { describe, expect, it } from 'vitest';
import { generate } from '../src/commands/generate';
import type { GeneratorProbe } from '../src/generate/generator-probe';
import { read, scaffoldEverything, tempDir } from './helpers';

const BILLING = 'src/contexts/billing';

describe('generate, under the probe of a replayed plan', () => {
  it('writes the declarations a later command builds on, and none of the documents nobody reads in the copy', () => {
    const root = tempDir('generate-under-a-probe');

    scaffoldEverything(root);

    const context = read(root, `${BILLING}/CONTEXT.md`);
    const created: string[] = [];

    const probe: GeneratorProbe = {
      language: () => undefined,
      builtOn: () => undefined,
      created: (files) => created.push(...files),
    };

    const code = generate(
      ['query', 'billing', 'SearchLateInvoices', '--public', '--cwd', root],
      { out: () => undefined, err: () => undefined },
      probe,
    );

    expect(code).toBe(0);
    expect(created).toContain(`${BILLING}/application/queries/search-late-invoices/search-late-invoices.handler.ts`);
    expect(read(root, `${BILLING}/application/application.declarations.ts`)).toContain('search-late-invoices.handler');
    expect(read(root, `${BILLING}/CONTEXT.md`)).toBe(context);
  });
});
