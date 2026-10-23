import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { ROLE_FOLDERS } from '../src/model-modules/index.js';
import { checkJsonOf } from './check-support.js';
import { cli, exists, read, scaffoldEverything, tempDir, write } from './helpers.js';
import { BILLING, projectWithModule, PURPOSE } from './support/project-with-module.js';

/** The same text with the module level left out of every path of billing: what it would say without modules. */
function withoutModule(text: string): string {
  return text
    .replaceAll(`${BILLING}/domain/invoices/`, `${BILLING}/domain/`)
    .replaceAll(`${BILLING}/application/invoices/`, `${BILLING}/application/`);
}

/** Every role folder of the model and of the use cases of billing, relative to the context. */
function roleFoldersOfBilling(root: string): string[] {
  return ['domain', 'application'].flatMap((layer) =>
    fs
      .readdirSync(path.join(root, BILLING, layer))
      .filter((folder) => ROLE_FOLDERS[layer]?.includes(folder) === true)
      .map((folder) => `${layer}/${folder}`),
  );
}

function errorsOf(root: string): string[] {
  return checkJsonOf(cli(root, 'check', '--json'))
    .violations.filter((violation) => violation.severity === 'error')
    .map((violation) => `${violation.ruleId} ${withoutModule(violation.file)}`)
    .sort();
}

describe('a whole context moved into a module of its model', () => {
  let root: string;
  let before: { describe: string; errors: string[] };

  beforeAll(() => {
    root = tempDir('modules-moved');
    scaffoldEverything(root);
    before = { describe: cli(root, 'describe', 'billing', '--json').stdout, errors: errorsOf(root) };

    expect(cli(root, 'generate', 'module', 'billing', 'invoices', '--purpose', PURPOSE).code).toBe(0);
    expect(cli(root, 'move-to-module', 'billing', 'invoices', ...roleFoldersOfBilling(root)).code).toBe(0);
  }, 120_000);

  it('is described as it was, every path in the module: nothing is lost from describe and CONTEXT.md', () => {
    const after = cli(root, 'describe', 'billing', '--json').stdout;

    expect(after).toContain(`${BILLING}/application/invoices/commands/issue-invoice`);
    expect(after).toContain(`${BILLING}/domain/invoices/repositories/invoice.repository.ts`);
    expect(withoutModule(after)).toBe(before.describe);
  });

  it('keeps the files that are one per context at the level of the context', () => {
    expect(exists(root, `${BILLING}/domain/invoices/errors/codes.ts`)).toBe(false);
    expect(exists(root, `${BILLING}/application/authorization/billing.permissions.ts`)).toBe(true);
  });

  it('leaves the checks as they were, the module declared and every import following its file', () => {
    expect(errorsOf(root)).toEqual(before.errors);
  });

  it('declares the module in the config and gives it its row in CONTEXT.md', () => {
    expect(JSON.parse(read(root, 'ddd-ts-kit.config.json')).contexts.billing.modules).toEqual({ invoices: {} });
    expect(read(root, `${BILLING}/CONTEXT.md`)).toContain(`| \`invoices\` | ${PURPOSE} |`);
  });
});

describe('generating into a module of the model', () => {
  let root: string;

  beforeAll(() => {
    root = projectWithModule();
  }, 120_000);

  it('writes the files of the model and of the use case in the module, and the imports follow them', () => {
    const terms = ['--term', 'Credit=An amount given back', '--term', 'Note=A written record'];

    expect(cli(root, 'generate', 'aggregate', 'billing', 'CreditNote', '--module', 'invoices', ...terms).code).toBe(0);

    const command = cli(
      root,
      'generate',
      'command',
      'billing',
      'IssueCreditNote',
      '--aggregate',
      'CreditNote',
      '--permission',
      'credit-note.issue',
      '--module',
      'invoices',
    );

    expect(command.code).toBe(0);
    expect(exists(root, `${BILLING}/domain/invoices/aggregates/credit-note.aggregate.ts`)).toBe(true);

    const handler = read(
      root,
      `${BILLING}/application/invoices/commands/issue-credit-note/issue-credit-note.handler.ts`,
    );

    expect(handler).toContain('@/contexts/billing/domain/invoices/aggregates/credit-note.aggregate');

    expect(read(root, `${BILLING}/test/builders/credit-note.builder.ts`)).toContain(
      '/domain/invoices/aggregates/credit-note.aggregate',
    );
  });

  it('refuses to write a file of the model without saying in which module, and says how', () => {
    const refused = cli(
      root,
      'generate',
      'value-object',
      'billing',
      'Discount',
      '--term',
      'Discount=An amount taken off',
    );

    expect(refused.code).not.toBe(0);
    expect(refused.stderr).toContain('--module <invoices>');
  });

  it('refuses a module the context does not declare, and says how to declare it', () => {
    const refused = cli(root, 'generate', 'value-object', 'billing', 'Discount', '--module', 'payments');

    expect(refused.code).not.toBe(0);
    expect(refused.stderr).toContain('ddd-ts-kit generate module billing payments');
  });

  it('reads the module the way the config writes it, whatever the case it is typed in', () => {
    const generated = cli(
      root,
      'generate',
      'value-object',
      'billing',
      'Rebate',
      '--term',
      'Rebate=An amount given back',
      '--module',
      'Invoices',
    );

    expect(generated.code).toBe(0);
    expect(exists(root, `${BILLING}/domain/invoices/value-objects/rebate.vo.ts`)).toBe(true);
  });

  it('moves nothing when a file of the same name is in the module already, and loses nothing', () => {
    const flat = `${BILLING}/domain/value-objects/rebate.vo.ts`;

    write(root, flat, 'export const kept = 1;\n');

    const refused = cli(root, 'move-to-module', 'billing', 'invoices', 'domain/value-objects/rebate.vo.ts');

    expect(refused.code).not.toBe(0);
    expect(refused.stderr).toContain('Nothing was moved');
    expect(read(root, flat)).toBe('export const kept = 1;\n');
    expect(read(root, `${BILLING}/domain/invoices/value-objects/rebate.vo.ts`)).not.toContain('kept');
  });

  it('moves every file of a folder, not only its sources, and leaves no empty folder behind', () => {
    write(root, `${BILLING}/application/commands/cancel-invoice/NOTES.md`, 'Why a paid invoice cannot be cancelled.\n');

    expect(cli(root, 'move-to-module', 'billing', 'invoices', 'application/commands/cancel-invoice').code).toBe(0);
    expect(read(root, `${BILLING}/application/invoices/commands/cancel-invoice/NOTES.md`)).toContain('paid invoice');
    expect(exists(root, `${BILLING}/application/commands/cancel-invoice`)).toBe(false);
  });
});
