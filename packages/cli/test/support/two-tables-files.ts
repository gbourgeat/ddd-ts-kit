import fs from 'node:fs';
import path from 'node:path';
import { expect } from 'vitest';
import { cli, read, write } from '../helpers';
import { commitAll } from './commit-all';
import { expectOk } from './expect-ok';
import { git } from './git';
import { INDEX, store } from './index-invariant';
import { goOn, merging, mergeTrunk } from './trunk-history';

export const FLAT = 'src/contexts/billing/infrastructure/persistence/billing.schema.ts';
export const SHARED = 'src/contexts/billing/shared/infrastructure/persistence/billing.schema.ts';

/** billing laid out in modules, `invoicing` its first module, and this aggregate in it with its repository. */
export function layOut(aggregate: string): (project: string) => void {
  return (project) => {
    const run = (...args: string[]): void => void expectOk(cli(project, ...args));

    commitAll(project);

    run(
      'generate',
      'module',
      'billing',
      'invoicing',
      '--purpose',
      'Bills the orders.',
      '--term',
      'Invoicing=billing the orders',
    );

    run('context-layout', 'billing');
    commitAll(project);

    run(
      'generate',
      'aggregate',
      'billing',
      aggregate,
      '--module',
      'invoicing',
      '--term',
      `${aggregate}=a thing billing keeps`,
    );

    run('generate', 'repository', 'billing', aggregate, '--module', 'invoicing');
  };
}

/** Payment stored flat in billing and in shipping; with `apart`, the schema and the table of the flat file of billing renamed by hand. */
export function flatPayments(apart: boolean): (project: string) => void {
  return (project) => {
    store(project, 'billing', 'Payment');
    store(project, 'shipping', 'Payment');

    if (apart) {
      write(
        project,
        FLAT,
        read(project, FLAT)
          .replaceAll('billingSchema', 'billingLedgerSchema')
          .replace("table('payments'", "table('flat_payments'"),
      );
    }
  };
}

/** Each conflicted path resolved keeping both sides, every path added. */
function resolveKeepingBoth(root: string): void {
  for (const file of git(root, 'diff', '--name-only', '--diff-filter=U')
    .split('\n')
    .filter((path) => path !== '')) {
    write(root, file, read(root, file).replace(/^(?:<{7}|={7}|>{7}|\|{7}).*\n/gm, ''));
  }

  git(root, 'add', '--all');
}

/** The dry run, then merge-trunk to its commit through each stop: every report. */
export function merged(root: string): { previewed: string; said: string } {
  const previewed = mergeTrunk(root, '--dry-run').stdout;
  const said = [mergeTrunk(root).stdout];

  for (const args of [['--continue'], ['--continue'], ['--continue', '--accept-lost']]) {
    if (merging(root)) {
      resolveKeepingBoth(root);
      said.push(goOn(root, ...args).stdout);
    }
  }

  expect(merging(root)).toBe(false);

  return { previewed, said: said.join('\n') };
}

/**
 * What the sentence asks of two files that both declare `payments`, done as a person would: the
 * other table renamed where it is declared and in every file that imports it, every table of the
 * flat file moved into `shared/` on its schema, the flat file and its `export *` line gone, every
 * other line that names the flat file pointed at `shared/`.
 */
export function makeThemOneFile(
  root: string,
  { keeper, renamed }: { keeper: 'flat' | 'shared'; renamed: string },
): void {
  const other = keeper === 'flat' ? 'src/contexts/billing/invoicing' : 'src/contexts/billing/infrastructure';
  const word = /(?<![\w$'"])payments(?![\w$'"])/g;

  write(
    root,
    keeper === 'flat' ? SHARED : FLAT,
    read(root, keeper === 'flat' ? SHARED : FLAT).replace(/\bexport const payments\b/, `export const ${renamed}`),
  );

  for (const file of sourcesOf(root, other).filter((path) => /\.(?:repository|mapper)\.ts$/.test(path))) {
    write(root, file, read(root, file).replace(word, renamed));
  }

  const region = (text: string): string =>
    /\/\/ ddd-ts-kit:tables\n([\s\S]*?)\/\/ \/ddd-ts-kit:tables/.exec(text)?.[1] ?? '';

  const moved = region(read(root, FLAT)).replaceAll('billingLedgerSchema', 'billingSchema');

  write(root, SHARED, read(root, SHARED).replace('// /ddd-ts-kit:tables', `${moved}// /ddd-ts-kit:tables`));
  fs.rmSync(path.join(root, FLAT));

  const flatAlias = '@/contexts/billing/infrastructure/persistence/billing.schema';

  write(root, INDEX, read(root, INDEX).replace(`export * from '${flatAlias}';\n`, ''));
  pointAtShared(root);
}

/** Every import and every line of the index that names the flat tables file of billing names the one of `shared/`. */
function pointAtShared(root: string): void {
  const flatAlias = '@/contexts/billing/infrastructure/persistence/billing.schema';

  for (const file of sourcesOf(root, 'src')) {
    const persistence = file.startsWith('src/contexts/billing/infrastructure/persistence/');
    const text = read(root, file);

    const pointed = text
      .replaceAll(`'${flatAlias}'`, `'${flatAlias.replace('/billing/', '/billing/shared/')}'`)
      .replaceAll(
        "'./billing.schema'",
        persistence ? "'../../shared/infrastructure/persistence/billing.schema'" : "'./billing.schema'",
      );

    if (pointed !== text) {
      write(root, file, pointed);
    }
  }
}

/** What the sentence asks, done as a person would: the tables moved, every line that names the flat file pointed at `shared/`, the flat file and its line gone. */
export function followTheAdvice(root: string): void {
  const region = (text: string): string =>
    /\/\/ ddd-ts-kit:tables\n([\s\S]*?)\/\/ \/ddd-ts-kit:tables/.exec(text)?.[1] ?? '';

  const flatAlias = '@/contexts/billing/infrastructure/persistence/billing.schema';

  write(
    root,
    SHARED,
    read(root, SHARED).replace('// /ddd-ts-kit:tables', `${region(read(root, FLAT))}// /ddd-ts-kit:tables`),
  );

  for (const file of sourcesOf(root, 'src')) {
    const persistence = file.startsWith('src/contexts/billing/infrastructure/persistence/');
    const text = read(root, file);

    const pointed = text
      .replaceAll(`'${flatAlias}'`, `'${flatAlias.replace('/billing/', '/billing/shared/')}'`)
      .replaceAll(
        "'./billing.schema'",
        persistence ? "'../../shared/infrastructure/persistence/billing.schema'" : "'./billing.schema'",
      );

    if (pointed !== text) {
      write(root, file, pointed);
    }
  }

  const index = read(root, INDEX).split('\n');
  const star = `export * from '${flatAlias.replace('/billing/', '/billing/shared/')}';`;

  // The line of the flat file now names `shared/` as its neighbour does: one of the two goes.
  write(root, INDEX, index.filter((line, at) => line !== star || index.indexOf(line) === at).join('\n'));
  fs.rmSync(path.join(root, FLAT));
}

function sourcesOf(root: string, directory: string): string[] {
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const relative = `${directory}/${entry.name}`;

    return entry.isDirectory() ? sourcesOf(root, relative) : relative.endsWith('.ts') ? [relative] : [];
  });
}
