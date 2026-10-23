import { describe, expect, it } from 'vitest';
import { CliError } from '../src/cli-error';
import { classifyConflict } from '../src/merge/classify-conflict';
import { conflictBlocks } from '../src/merge/conflict-blocks';
import { gitVersion } from '../src/merge/git-version';
import { mentionedTables } from '../src/merge/mentioned-tables';
import { mergeSlicesRows } from '../src/merge/merge-slices-rows';
import { mergeStoredEventsLock } from '../src/merge/merge-stored-events-lock';
import { nextMigrationNumber } from '../src/merge/next-migration-number';
import { previewMerge } from '../src/merge/preview-merge';
import { registryUnion } from '../src/merge/registry-union';
import { trunkRepository } from './support/trunk-history';

const NOW = new Date('2026-10-17T10:00:00Z');

describe('merge-trunk: its parts', () => {
  it('tells a git that computes a merge from a given base from an older one', () => {
    expect(gitVersion('.', 'git version 2.43.0')).toEqual({ version: '2.43.0', mergeBase: true });
    expect(gitVersion('.', 'git version 3.1')).toEqual({ version: '3.1', mergeBase: true });
    expect(gitVersion('.', 'git version 2.39.5 (Apple Git-154)')).toEqual({ version: '2.39.5', mergeBase: false });
    expect(gitVersion('.', 'not git')).toEqual({ version: 'unknown', mergeBase: false });
    expect(gitVersion('.').mergeBase).toBe(true);
  });

  it('numbers a renamed migration after the previous one, in its format, never before now', () => {
    expect(nextMigrationNumber('20261016090000', NOW)).toBe('20261017100000');
    expect(nextMigrationNumber('20261018235959', NOW)).toBe('20261019000000');
    expect(nextMigrationNumber('1760000000000', NOW)).toBe(String(NOW.getTime()));
    expect(nextMigrationNumber('1890000000000', NOW)).toBe('1890000000001');
    expect(nextMigrationNumber('0007', NOW)).toBe('0008');
  });

  it('reads the tables a migration changes, in SQL and in the schema builder of knex', () => {
    const sql =
      'CREATE TABLE IF NOT EXISTS "billing"."invoices" (id uuid REFERENCES customers(id));\nCREATE UNIQUE INDEX one ON payments (id);\nALTER TABLE ONLY Credit_Notes ADD x int;';

    const knex = "knex.schema.alterTable('appointments', () => {}).dropTableIfExists(`calendars`)";

    expect([...mentionedTables(sql)].sort()).toEqual(['credit_notes', 'customers', 'invoices', 'payments']);
    expect([...mentionedTables(knex)].sort()).toEqual(['appointments', 'calendars']);
    expect(mentionedTables('-- nothing here').size).toBe(0);
  });

  it('reads a block left open at the end of a file as settled lines', () => {
    expect(conflictBlocks('a\n<<<<<<< HEAD\nb\n=======\nc')).toEqual([
      { kind: 'settled', lines: ['a'] },
      { kind: 'settled', lines: ['<<<<<<< HEAD', 'b', '=======', 'c'] },
    ]);

    expect(conflictBlocks('<<<<<<< HEAD\nb\n=======\nc\n>>>>>>> main')).toEqual([
      {
        kind: 'conflict',
        ours: ['b'],
        base: [],
        theirs: ['c'],
        raw: ['<<<<<<< HEAD', 'b', '=======', 'c', '>>>>>>> main'],
        line: 1,
      },
    ]);
  });

  it('classifies by the path in the project, a path outside it being a source', () => {
    const repo = { top: '/repository', prefix: 'apps/billing/', contextsDir: 'src/contexts', modules: {} };

    expect(classifyConflict('apps/billing/stored-events.lock.json', repo)).toBe('stored-events');
    expect(classifyConflict('apps/billing/pnpm-lock.yaml', repo)).toBe('lockfile');
    expect(classifyConflict('apps/billing/src/contexts/billing/CONTEXT.md', repo)).toBe('mixed');
    expect(classifyConflict('pnpm-lock.yaml', repo)).toBe('source');
  });

  it('merges registry lines without the imports rules when the region holds more than whole statements', () => {
    const block = {
      kind: 'conflict' as const,
      ours: ['import {', '  Invoice,', "} from './invoice';"],
      base: [],
      theirs: ['  Payment,'],
      raw: [],
      line: 1,
    };

    expect(registryUnion(block, 'imports')).toEqual(['import {', '  Invoice,', "} from './invoice';", '  Payment,']);
  });

  it('merges slices rows the base lacks, rows one side deleted, and the text around the tables', () => {
    const table = (...rows: string[]): string =>
      [
        '# Slices',
        '| # | context | kind | slice | start with | depends on | owner | status |',
        '|---|---|---|---|---|---|---|---|',
        ...rows,
        '',
      ].join('\n');

    const row = (id: string, status: string): string =>
      `| ${id} | billing | slice | S${id} | g | | billing | ${status} |`;

    const base = table(row('1', 'todo'), row('2', 'todo'));
    const ours = `${table(row('1', 'todo'))}\nNotes of the branch.\n`;
    const theirs = table(row('0', 'todo'), row('1', 'done'), row('2', 'todo'));

    expect(mergeSlicesRows(base, ours, theirs)).toEqual({
      text: `${table(row('1', 'done'), row('0', 'todo'))}\nNotes of the branch.\n`,
    });

    expect(mergeSlicesRows(base, `${base}x\n`, `${base}y\n`)).toEqual({ conflicts: ['the text around the tables'] });

    expect(mergeSlicesRows('', table(row('3', 'todo')), table(row('3', 'done')))).toEqual({
      text: table(row('3', 'done')),
    });
  });

  it('refuses a stored-events lock that is not JSON', () => {
    expect(mergeStoredEventsLock('not json', '{}')).toEqual({ conflicts: ['a side that is not a JSON object'] });
    expect(mergeStoredEventsLock('[]', '{}')).toEqual({ conflicts: ['a side that is not a JSON object'] });
  });

  it('refuses to preview a merge with a side git does not know', () => {
    const root = trunkRepository({ 'a.ts': 'a\n' });

    expect(() => previewMerge(root, { ours: 'HEAD', theirs: 'nowhere' })).toThrow(CliError);
  });
});
