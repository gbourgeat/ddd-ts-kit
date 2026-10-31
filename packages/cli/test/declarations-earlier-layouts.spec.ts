import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { specifierOf } from '../src/alias';
import { readConfig } from '../src/config';
import { contextDeclarations, isDeclarationsFile, singleFileDeclarations, type DeclaredContext } from '../src/declared';
import { filesUnder } from '../src/generate/files-under';
import { workspaceSources } from '../src/generate/workspace-sources';
import { declaredModules } from '../src/model-modules';
import { Workspace } from '../src/workspace';
import { cli, read, scaffoldEverything, tempDir, write } from './helpers';

const BILLING = 'src/contexts/billing';

let root: string;

beforeAll(() => {
  root = tempDir('declarations-earlier-layouts');
  scaffoldEverything(root);
});

describe('a context still declared in the single file of 0.84', () => {
  const summary = `${BILLING}/billing.declarations.ts`;
  const application = `${BILLING}/application/application.declarations.ts`;

  it('is an error for check, a move for docs --check, and generate --local-only leaves it alone', () => {
    const single = toSingleFile('billing');

    const checked = cli(root, 'check', '--rule', 'declarations/barrel-current', '--json');

    expect(checked.code).toBe(1);

    expect(checked.json()).toMatchObject({
      errors: 1,
      violations: [{ ruleId: 'declarations/barrel-current', severity: 'error', file: summary }],
    });

    const said = cli(root, 'check', '--rule', 'declarations/barrel-current').stdout;

    expect(said).toContain('"billing" still keeps all its declarations in billing.declarations.ts');
    expect(said).toContain('a context declares its role files in the <layer>.declarations.ts of each layer now');
    expect(said).toContain('Run `npx ddd-ts-kit docs`');

    const docs = cli(root, 'docs', '--check');

    expect(docs.code).toBe(1);
    expect(docs.stdout).toContain(`stale  ${application}`);
    expect(docs.stdout).toContain('Run `ddd-ts-kit docs` and commit the result.');
    expect(read(root, summary)).toBe(single);

    const local = cli(root, 'generate', 'port', 'shipping', 'CarrierRates', '--local-only');

    expect(local.code).toBe(0);
    expect(local.stdout).toContain('note: "billing" still keeps all its declarations in billing.declarations.ts');
    expect(read(root, summary)).toBe(single);
  });

  it('is an error once the single file is stale, or once the context is half moved', () => {
    const single = read(root, summary);
    const job = "export * from '@/contexts/billing/application/scheduling/cancel-stale-invoices.job';\n";

    expect(single).toContain(job);
    write(root, summary, single.replace(job, ''));
    expect(cli(root, 'check', '--rule', 'declarations/barrel-current').code).toBe(1);
    expect(cli(root, 'docs', '--check').code).toBe(1);

    write(root, summary, single);

    write(
      root,
      application,
      "export * from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.command';\n",
    );

    expect(cli(root, 'check', '--rule', 'declarations/barrel-current').code).toBe(1);
    expect(cli(root, 'docs', '--check').code).toBe(1);
    fs.rmSync(path.join(root, application));
  });

  it('stays in its single file when generate --local-only writes a role file there', () => {
    const local = cli(
      root,
      'generate',
      'command',
      'billing',
      'VoidInvoice',
      '--permission',
      'invoice.void',
      '--allow-name',
      '--local-only',
    );

    expect(local.code).toBe(0);
    expect(fs.existsSync(path.join(root, application))).toBe(false);
    expect(read(root, summary)).toContain('void-invoice.handler');

    expect(cli(root, 'check', '--rule', 'declarations/barrel-current', '--json').json()).toMatchObject({
      errors: 1,
      warnings: 0,
    });
  });

  it('moves to the declarations of the layers on docs, and the error goes', () => {
    const moved = cli(root, 'docs');

    expect(moved.stdout).toMatch(new RegExp(`created\\s+${application}`));

    expect(read(root, summary)).toContain("export * from '@/contexts/billing/application/application.declarations';");

    const checked = cli(root, 'check', '--rule', 'declarations/barrel-current', '--json');

    expect(checked.json()).toMatchObject({ errors: 0, warnings: 0 });
    expect(cli(root, 'docs', '--check').stdout).toBe('The generated documentation is up to date.');
  });
});

describe('a context still declared in the files of its role folders, as 0.85 and 0.86 wrote them', () => {
  const summary = `${BILLING}/billing.declarations.ts`;
  const commands = `${BILLING}/application/commands/commands.declarations.ts`;

  it('is an error for check, a move for docs --check, and generate --local-only leaves it alone', () => {
    toRoleFolders('billing');

    const checked = cli(root, 'check', '--rule', 'declarations/barrel-current', '--json');

    expect(checked.code).toBe(1);

    expect(checked.json()).toMatchObject({
      errors: 1,
      violations: [{ ruleId: 'declarations/barrel-current', severity: 'error', file: summary }],
    });

    expect(cli(root, 'check', '--rule', 'declarations/barrel-current').stdout).toContain(
      '"billing" still keeps its declarations in one file per role folder',
    );

    const docs = cli(root, 'docs', '--check');

    expect(docs.code).toBe(1);
    expect(docs.stdout).toContain(`stale  ${commands}`);

    const local = cli(root, 'generate', 'port', 'shipping', 'ParcelTracking', '--local-only');

    expect(local.code).toBe(0);
    expect(local.stdout).toContain('note: "billing" still keeps its declarations in one file per role folder');
    expect(fs.existsSync(path.join(root, commands))).toBe(true);
  });

  it('is an error once one of its files is stale', () => {
    const written = read(root, commands);
    const handler = "export * from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.handler';\n";

    expect(written).toContain(handler);
    write(root, commands, written.replace(handler, ''));
    expect(cli(root, 'check', '--rule', 'declarations/barrel-current').code).toBe(1);
    write(root, commands, written);
  });

  it('is still an error when two role files have one name, which the summary would export twice', () => {
    const twin = `${BILLING}/application/queries/issue-invoice/issue-invoice.handler.ts`;

    write(root, twin, read(root, `${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`));
    toRoleFolders('billing');

    const checked = cli(root, 'check', '--rule', 'declarations/barrel-current');

    expect(checked.code).toBe(1);
    expect(checked.stdout).toContain(`${twin}:1  error`);
    fs.rmSync(path.join(root, twin));
    toRoleFolders('billing');
  });

  it('stays in the files of its role folders when generate --local-only writes a role file there', () => {
    const local = cli(
      root,
      'generate',
      'command',
      'billing',
      'ReopenInvoice',
      '--permission',
      'invoice.reopen',
      '--allow-name',
      '--local-only',
    );

    expect(local.code).toBe(0);
    expect(fs.existsSync(path.join(root, `${BILLING}/application/application.declarations.ts`))).toBe(false);
    expect(read(root, commands)).toContain('reopen-invoice.handler');

    expect(cli(root, 'check', '--rule', 'declarations/barrel-current', '--json').json()).toMatchObject({
      errors: 1,
      warnings: 0,
    });
  });

  it('moves to the declarations of the layers on docs, which deletes the files of the role folders', () => {
    const moved = cli(root, 'docs');

    expect(moved.stdout).toMatch(new RegExp(`deleted\\s+${commands}`));
    expect(fs.existsSync(path.join(root, commands))).toBe(false);
    expect(read(root, summary)).toContain("export * from '@/contexts/billing/application/application.declarations';");
    expect(cli(root, 'check', '--rule', 'declarations/barrel-current', '--json').json()).toMatchObject({ errors: 0 });
  });
});

/** A context of the scaffolded project, read where its files are. */
function declaredContext(context: string): DeclaredContext {
  const ws = new Workspace(root, false);
  const { config } = readConfig(root);
  const directory = `${config.contextsDir}/${context}`;

  return {
    context,
    directory,
    entries: filesUnder(ws, directory),
    sources: workspaceSources(ws, config),
    modules: declaredModules(config, context),
    specifierOf: (file) => specifierOf(config, file),
  };
}

/** Puts a context back in the layout the generator wrote in 0.85 and 0.86: one declarations file per role folder. */
function toRoleFolders(context: string): void {
  const declared = declaredContext(context);
  const { directory, entries, modules } = declared;

  for (const entry of entries.filter((candidate) => isDeclarationsFile(context, candidate, modules))) {
    fs.rmSync(path.join(root, directory, entry));
  }

  contextDeclarations(declared, 'role-folder').files.forEach((content, entry) =>
    write(root, `${directory}/${entry}`, content),
  );
}

/**
 * Puts a context back in the layout the generator wrote up to 0.84: every declaration in
 * `<context>.declarations.ts`, no declarations file in a role folder. Answers that file.
 */
function toSingleFile(context: string): string {
  const declared = declaredContext(context);
  const { directory, entries, modules } = declared;
  const single = singleFileDeclarations(declared);

  for (const entry of entries.filter((candidate) => isDeclarationsFile(context, candidate, modules))) {
    fs.rmSync(path.join(root, directory, entry));
  }

  write(root, `${directory}/${context}.declarations.ts`, single);

  return single;
}
