import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, exists, read, REPO_ROOT, write } from './helpers';
import { failure, report } from './reports';
import { initProject } from './support/init-project';

const BILLING = 'src/contexts/billing';
const AGGREGATE = `${BILLING}/domain/aggregates/invoice.aggregate.ts`;
const BUILDER = `${BILLING}/test/builders/invoice.builder.ts`;
const SPEC = `${BILLING}/test/unit/invoice.aggregate.spec.ts`;
const EVENT = `${BILLING}/domain/events/invoice-issued.event.ts`;
const EVENT_SPEC = `${BILLING}/test/unit/invoice-issued.event.spec.ts`;
const COMPILER = path.join(REPO_ROOT, 'node_modules/@typescript/native/bin/tsc');

/** A project on the default stack with a billing context that knows the invoice and its issue. */
function billing(): string {
  const root = initProject();

  const context = cli(
    root,
    'generate',
    'context',
    'billing',
    '--classification',
    'core',
    '--term',
    'Invoice=A request for payment',
    '--term',
    'Issue=To make an invoice final',
  );

  expect(context.code, context.stderr).toBe(0);

  return root;
}

function born(birth: string, ...more: string[]): string {
  const root = billing();
  const generated = cli(root, 'generate', 'aggregate', 'billing', 'Invoice', '--birth', birth, ...more);

  expect(generated.code, generated.stderr).toBe(0);

  return root;
}

/** The compiler on the files of the context, with the packages of the repository in place of an install. */
function compiled(root: string): string {
  fs.symlinkSync(path.join(REPO_ROOT, 'node_modules'), path.join(root, 'node_modules'), 'dir');

  write(
    root,
    'tsconfig.billing.json',
    JSON.stringify({ extends: './tsconfig.json', compilerOptions: { noEmit: true }, include: [BILLING] }),
  );

  try {
    return execFileSync(process.execPath, [COMPILER, '-p', 'tsconfig.billing.json'], { cwd: root, encoding: 'utf8' });
  } catch (error) {
    return error instanceof Error && 'stdout' in error ? String(error.stdout) : String(error);
  }
}

describe('generate aggregate --birth, the fact an aggregate is born with', () => {
  it('writes the event of its birth, and the aggregate, the builder and the spec named after the fact', () => {
    const root = billing();

    const result = report(
      cli(root, 'generate', 'aggregate', 'billing', 'Invoice', '--birth', 'Invoice Issued', '--json'),
    );

    expect(result.created).toEqual([AGGREGATE, BUILDER, SPEC, EVENT, EVENT_SPEC]);

    expect(read(root, AGGREGATE)).toContain(
      "import { InvoiceIssued } from '@/contexts/billing/domain/events/invoice-issued.event';",
    );

    expect(read(root, AGGREGATE)).toContain(
      '    const created = new Invoice(id, {});\n\n    created.record(new InvoiceIssued(id, now));\n\n    return created;',
    );

    expect(read(root, BUILDER)).toContain('  readonly issuedAt: Date;');

    expect(read(root, BUILDER)).toContain(
      "  issuedAt(instant: Date): this {\n    return this.with('issuedAt', instant);",
    );

    expect(read(root, BUILDER)).toContain('    return Invoice.create(ingredients.id, ingredients.issuedAt);');

    expect(read(root, SPEC)).toContain(
      "it('records the fact of its birth, invoice issued, at the instant it is given'",
    );

    expect(read(root, SPEC)).toContain(
      "expect(born.pullEvents()).toEqual([new InvoiceIssued('invoice-7', issuedAt)]);",
    );

    expect(read(root, SPEC)).not.toContain("it.todo('records the fact of its birth')");

    for (const file of [AGGREGATE, BUILDER, SPEC]) {
      expect(read(root, file), file).not.toMatch(/registeredAt|bornAt|TODO\(domain\): name the fact/);
    }
  });

  it('writes the event generate domain-event writes, and names the same one from the fact alone or in one word', () => {
    const root = born('Invoice Issued');
    const reference = billing();

    expect(cli(reference, 'generate', 'domain-event', 'billing', 'Invoice', 'Issued').code).toBe(0);
    expect(read(root, EVENT)).toBe(read(reference, EVENT));
    expect(read(root, EVENT_SPEC)).toBe(read(reference, EVENT_SPEC));
    expect(read(root, EVENT)).toContain("NamedDomainEvent('billing.invoice.issued')");

    for (const birth of ['Issued', 'InvoiceIssued', 'invoice-issued']) {
      const again = born(birth);

      expect(
        [AGGREGATE, BUILDER, SPEC, EVENT].map((file) => read(again, file)),
        birth,
      ).toEqual([AGGREGATE, BUILDER, SPEC, EVENT].map((file) => read(root, file)));
    }
  });

  it('type-checks as generated on the default stack, with its repository and the command that gives birth to it', () => {
    const root = born('Invoice Issued');

    expect(cli(root, 'generate', 'repository', 'billing', 'Invoice').code).toBe(0);

    const command = cli(
      root,
      'generate',
      'command',
      'billing',
      'IssueInvoice',
      '--creates',
      '--aggregate',
      'Invoice',
      '--permission',
      'invoice.issue',
      '--grant',
      'accountant',
    );

    expect(command.code, command.stderr).toBe(0);
    expect(compiled(root)).toBe('');
  });

  it('keeps no invented instant in the storage: the audit columns of the row hold when it was created', () => {
    const root = born('Issued');

    expect(cli(root, 'generate', 'repository', 'billing', 'Invoice').code).toBe(0);

    const schema = read(root, `${BILLING}/infrastructure/persistence/billing.schema.ts`);

    expect(schema).toContain('...auditColumns(),');
    expect(schema).not.toMatch(/registered|timestamp/);

    expect(read(root, `${BILLING}/infrastructure/persistence/invoice.mapper.ts`)).toContain(
      'const loaded = Invoice.rehydrate(row.id, {});',
    );
  });

  it('builds an existing aggregate born with a fact with the instant named after it', () => {
    const root = born('Issued');
    const builder = read(root, BUILDER);

    fs.rmSync(path.join(root, BUILDER));

    expect(cli(root, 'generate', 'builder', 'billing', 'Invoice').code).toBe(0);
    expect(read(root, BUILDER)).toBe(builder);
  });
});

describe('generate aggregate without --birth', () => {
  it('leaves no instant of its own, and its TODO asks for the flag that names the birth', () => {
    const root = billing();

    expect(cli(root, 'generate', 'aggregate', 'billing', 'Invoice').code).toBe(0);

    expect(read(root, AGGREGATE)).toContain(
      '    // TODO(domain): name the fact Invoice is born with, recorded at `now`: `ddd-ts-kit generate aggregate billing Invoice --birth "<Fact>" --force` names the birth and writes its event.\n    return created;',
    );

    expect(read(root, BUILDER)).toContain("    return { id: sequence('invoice') };");
    expect(read(root, SPEC)).toContain("it.todo('records the fact of its birth');");
    expect(exists(root, `${BILLING}/domain/events`)).toBe(false);

    for (const file of [AGGREGATE, BUILDER, SPEC]) {
      expect(read(root, file), file).not.toMatch(/registeredAt|bornAt|Created/);
    }
  });
});

describe('generate aggregate --birth refuses a fact', () => {
  it.each([
    ['that does not read as something that happened', 'Invoice', '"Invoice" does not read as something that happened.'],
    ['in words the glossary does not define', 'Invoice Opened', '"Opened" uses "opened", which the glossary of'],
    ['that is not a name', 'Issued!', '"Issued!" is not a valid fact name.'],
  ])('%s, and writes nothing', (_case, birth, message) => {
    const root = billing();
    const refused = cli(root, 'generate', 'aggregate', 'billing', 'Invoice', '--birth', birth, '--json');

    expect(refused.code).toBe(2);
    expect(failure(refused).message).toContain(message);
    expect(exists(root, AGGREGATE)).toBe(false);
    expect(exists(root, `${BILLING}/domain/events`)).toBe(false);
  });
});
