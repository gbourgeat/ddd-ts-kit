import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { parseConfig } from '../src/config';
import { unitFolderOf } from '../src/refusals/unit-folder-of';
import { cli, EXPLICIT_STACK, exists, read, scaffoldEverything, tempDir, write, type CliResult } from './helpers';
import { stringsAt } from './support/strings-at';

const CONFIG_FILE = 'ddd-ts-kit.config.json';

/** Declares `module` as a module of the model of `context`, in the config alone. */
function declareModule(root: string, context: string, module: string): void {
  const config = JSON.parse(read(root, CONFIG_FILE)) as { contexts: Record<string, { modules?: object }> };
  const declared = config.contexts[context] ?? {};

  config.contexts[context] = { ...declared, modules: { ...declared.modules, [module]: {} } };
  write(root, CONFIG_FILE, JSON.stringify(config, null, 2));
}

function move(root: string, from: string, to: string): void {
  write(root, to, read(root, from));
  fs.rmSync(path.join(root, from));
}

describe('controllers, on a context whose module holds its tests and whose route list sits in shared', () => {
  const BILLING = 'src/contexts/billing';
  const HTTP = `${BILLING}/invoices/presentation/http`;
  const UNIT = `${BILLING}/invoices/test/unit`;
  const SHARED_HTTP = `${BILLING}/shared/presentation/http`;

  let root: string;
  let outcome: CliResult;

  beforeAll(() => {
    root = tempDir('codemod-shared');

    scaffoldEverything(root, { ...EXPLICIT_STACK, style: 'declared', validation: 'class-validator' }, [
      '--routes',
      'functions',
    ]);

    declareModule(root, 'billing', 'invoices');
    move(root, `${BILLING}/presentation/http/cancel-invoice.route.ts`, `${HTTP}/cancel-invoice.route.ts`);
    move(root, `${BILLING}/test/unit/cancel-invoice.route.spec.ts`, `${UNIT}/cancel-invoice.route.spec.ts`);
    move(root, `${BILLING}/presentation/http/billing.routes.ts`, `${SHARED_HTTP}/billing.routes.ts`);
    move(root, `${BILLING}/test/unit/billing.routes.spec.ts`, `${UNIT}/billing.routes.spec.ts`);
    outcome = cli(root, 'controllers', '--json');
  }, 120_000);

  it('turns the route of the module in its folder, and moves its spec in the test folder of the module', () => {
    expect(outcome.code, outcome.stderr).toBe(0);
    expect(stringsAt(outcome.json(), 'blockers')).toEqual([]);
    expect(exists(root, `${HTTP}/invoices/cancel-invoice/cancel-invoice.controller.ts`)).toBe(true);
    expect(exists(root, `${UNIT}/cancel-invoice.controller.spec.ts`)).toBe(true);
    expect(exists(root, `${UNIT}/cancel-invoice.route.spec.ts`)).toBe(false);
  });

  it('writes the route groups where the context keeps them, in shared, and removes its list and the spec of it there', () => {
    expect(exists(root, `${SHARED_HTTP}/invoices.routes.ts`)).toBe(true);
    expect(exists(root, `${BILLING}/presentation/http/invoices.routes.ts`)).toBe(false);
    expect(exists(root, `${SHARED_HTTP}/billing.routes.ts`)).toBe(false);
    expect(exists(root, `${UNIT}/billing.routes.spec.ts`)).toBe(false);
  });
});

describe('the unit specs of a file a migration of refusals moves', () => {
  const config = parseConfig({ contexts: { scheduling: { classification: 'core', modules: { slots: {} } } } });
  const SCHEDULING = 'src/contexts/scheduling';
  const inModule = `${SCHEDULING}/slots/domain/errors/late.error.ts`;

  it('are those of the test folder of its module, then of the folder of the context named after it, where its spec is', () => {
    const held =
      (...folders: string[]) =>
      (folder: string) =>
        folders.includes(folder);

    expect(unitFolderOf(config, inModule, held(`${SCHEDULING}/slots/test/unit`, `${SCHEDULING}/test/unit/slots`))).toBe(
      `${SCHEDULING}/slots/test/unit`,
    );

    expect(unitFolderOf(config, inModule, held(`${SCHEDULING}/test/unit/slots`))).toBe(`${SCHEDULING}/test/unit/slots`);
    expect(unitFolderOf(config, inModule, held())).toBe(`${SCHEDULING}/test/unit`);
  });

  it('are those of the context for a file of no module, whatever holds a spec', () => {
    expect(unitFolderOf(config, `${SCHEDULING}/domain/errors/late.error.ts`, () => true)).toBe(
      `${SCHEDULING}/test/unit`,
    );
  });
});

describe('error-factories --apply, on an error of a module that holds its tests', () => {
  const ERRORS = 'src/contexts/scheduling/slots/domain/errors';
  const UNIT = 'src/contexts/scheduling/slots/test/unit';
  const lines = (...all: string[]): string => `${all.join('\n')}\n`;

  /** A project whose module slots holds the error TooLateError and its spec, in its own test folder. */
  function slotsProject(label: string): string {
    const root = tempDir(label);

    expect(cli(root, 'init', '--refusals', 'classes').code).toBe(0);
    cli(root, 'generate', 'context', 'scheduling', '--classification', 'core', '--term', 'Slot=A time to book');
    declareModule(root, 'scheduling', 'slots');

    write(
      root,
      `${ERRORS}/late.error.ts`,
      lines(
        "import { DomainError } from '@ddd-ts-kit/kernel';",
        '',
        'export class TooLateError extends DomainError {',
        "  readonly code = 'TOO_LATE';",
        '}',
      ),
    );

    write(
      root,
      `${UNIT}/late.error.spec.ts`,
      lines("describe('TooLateError', () => {", "  it('refuses late', () => new TooLateError());", '});'),
    );

    return root;
  }

  it('moves the spec of a class per error to the spec of its named class, in the test folder of the module', () => {
    const root = slotsProject('error-factories-named-module-tests');

    expect(cli(root, 'error-factories', '--plan').code).toBe(0);

    const applied = cli(root, 'error-factories', '--apply', '--json').json() as { removed: string[] };

    expect(applied.removed).toContain(`${UNIT}/late.error.spec.ts`);
    expect(read(root, `${UNIT}/too-late.error.spec.ts`)).toContain("describe('TooLate', () => {");
    expect(exists(root, 'src/contexts/scheduling/test/unit/too-late.error.spec.ts')).toBe(false);
  }, 120_000);

  it('moves the spec of a class per error to the spec of its concept class, in the test folder of the module', () => {
    const root = slotsProject('error-factories-concept-module-tests');

    expect(cli(root, 'error-factories', '--plan', '--to', 'factories').code).toBe(0);

    // The plan leaves the concept to name: the slot the refusal is about.
    write(
      root,
      'error-factories.plan.json',
      read(root, 'error-factories.plan.json').replace('"concept": ""', '"concept": "Slot"'),
    );

    const applied = cli(root, 'error-factories', '--apply', '--json');

    expect(applied.code, applied.stdout).toBe(0);
    expect(exists(root, `${UNIT}/late.error.spec.ts`)).toBe(false);
    expect(read(root, `${UNIT}/slot.error.spec.ts`)).toContain('SlotError.tooLate(');
    expect(exists(root, 'src/contexts/scheduling/test/unit/slot.error.spec.ts')).toBe(false);
  }, 120_000);
});
