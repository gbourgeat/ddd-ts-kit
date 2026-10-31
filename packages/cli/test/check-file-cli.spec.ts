import { performance } from 'node:perf_hooks';
import { beforeAll, describe, expect, it } from 'vitest';
import { AGGREGATE, checkJsonOf, HANDLER } from './check-support';
import { cli, read, scaffoldEverything, tempDir, write } from './helpers';

const ISSUED_INVOICE = 'src/contexts/billing/domain/aggregates/issued-invoice.aggregate.ts';

describe('check-file', () => {
  let root: string;

  beforeAll(() => {
    root = tempDir('check-file');
    scaffoldEverything(root);
  });

  it('runs the per-file rules on one file', () => {
    const adapter =
      "import { InMemoryInvoiceRepository } from '@/contexts/billing/infrastructure/persistence/in-memory-invoice.repository';";

    write(
      root,
      HANDLER,
      `${adapter}\n${read(root, HANDLER)}\nexport const repository = new InMemoryInvoiceRepository();\n`,
    );

    const result = cli(root, 'check-file', HANDLER, '--json');
    const { violations } = checkJsonOf(result);

    expect(result.code).toBe(1);

    expect(violations.map((violation) => violation.ruleId).sort()).toEqual([
      'composition/only-in-module',
      'layer/application-inward',
    ]);

    expect(violations.every((violation) => violation.file === HANDLER && violation.fix !== '')).toBe(true);
  });

  it('judges a given text as the content of a file not written yet, on the rules asked', () => {
    const planned = 'src/contexts/billing/domain/services/discount.service.ts';

    write(
      root,
      'tmp/discount.ts',
      "import express from 'express';\nexport class Discount { app() { return express; } }\n",
    );

    const judged = checkJsonOf(
      cli(root, 'check-file', planned, '--content-from', 'tmp/discount.ts', '--rule', 'layer/domain-purity', '--json'),
    );

    expect(judged.violations.map((violation) => [violation.ruleId, violation.file])).toEqual([
      ['layer/domain-purity', planned],
    ]);

    expect(cli(root, 'check-file', planned).code).toBe(2);

    expect(cli(root, 'check-file', planned, '--content-from', 'tmp/discount.ts', '--rule', 'test/no-mocks').code).toBe(
      0,
    );
  });

  it('accepts an absolute path and stays silent on a clean file', () => {
    const result = cli(tempDir('elsewhere'), 'check-file', `${root}/${AGGREGATE}`);

    expect(result.code).toBe(0);
    expect(result.stdout).toBe('0 errors, 0 warnings, 0 suppressions in 1 file.');
  });

  it('does not run the rules that need the whole tree', () => {
    write(root, ISSUED_INVOICE, 'export class IssuedInvoice {}\n');

    expect(cli(root, 'check-file', ISSUED_INVOICE).code).toBe(0);
    expect(checkJsonOf(cli(root, 'check', '--rule', 'test/spec-required', '--json')).errors).toBe(1);
  });

  it('ignores files that are not sources of the project', () => {
    expect(cli(root, 'check-file', 'package.json').stdout).toBe('0 errors, 0 warnings, 0 suppressions in 0 files.');
    expect(cli(root, 'check-file', 'scripts/openapi.ts').code).toBe(0);
  });

  it('refuses a path that exists nowhere, unless the text it will hold is given', () => {
    const missing = cli(root, 'check-file', 'src/contexts/billing/domain/servicess/x.ts');

    expect(missing.code).toBe(2);
    expect(missing.stderr).toContain('error: No such file: src/contexts/billing/domain/servicess/x.ts.');
    expect(missing.stderr).toContain('--content-from');
  });

  it('answers well under 200 ms', () => {
    const started = performance.now();

    for (let i = 0; i < 20; i += 1) {
      cli(root, 'check-file', AGGREGATE);
    }

    expect((performance.now() - started) / 20).toBeLessThan(50);
  });
});
