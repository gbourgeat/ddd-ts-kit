import { describe, expect, it } from 'vitest';
import { exists, read } from './helpers.js';
import { git } from './support/git.js';
import { commitFiles, lastMessage, mergeTrunk, onBranch, trunkRepository } from './support/trunk-history.js';

describe('merge-trunk: lockfile and decision records, end to end', () => {
  const manifest = (dependencies: Record<string, string>): string =>
    `${JSON.stringify({ name: 'billing', version: '1.0.0', dependencies }, null, 2)}\n`;

  it('takes the trunk lockfile and installs nothing when the branch left package.json alone', () => {
    const root = trunkRepository({
      'package.json': manifest({}),
      'package-lock.json': '{ "lockfileVersion": 3, "base": true }\n',
    });

    onBranch(root, 'build/billing');

    commitFiles(
      root,
      { 'package-lock.json': '{ "lockfileVersion": 3, "ours": true }\n', 'src/a.ts': 'export const a = 1;\n' },
      'feat(billing): a',
    );

    onBranch(root, 'main');
    commitFiles(root, { 'package-lock.json': '{ "lockfileVersion": 3, "theirs": true }\n' }, 'chore: lock (#2)');
    onBranch(root, 'build/billing');

    const result = mergeTrunk(root, '--json');

    expect(result.json()).toMatchObject({
      status: 'committed',
      automatic: [{ file: 'package-lock.json', kind: 'lockfile', how: 'lockfile: trunk side' }],
    });

    expect(read(root, 'package-lock.json')).toContain('"theirs": true');
  });

  it('installs again when the branch changed package.json since the base', () => {
    const root = trunkRepository({
      'package.json': manifest({}),
      'package-lock.json': '{ "lockfileVersion": 3, "base": true }\n',
    });

    onBranch(root, 'build/billing');

    commitFiles(
      root,
      {
        'package.json': manifest({}).replace('"1.0.0"', '"1.1.0"'),
        'package-lock.json': '{ "lockfileVersion": 3, "ours": true }\n',
      },
      'feat(billing): version',
    );

    onBranch(root, 'main');
    commitFiles(root, { 'package-lock.json': '{ "lockfileVersion": 3, "theirs": true }\n' }, 'chore: lock (#2)');
    onBranch(root, 'build/billing');

    const result = mergeTrunk(root, '--json');

    expect(result.json()).toMatchObject({
      status: 'committed',
      automatic: [
        { file: 'package-lock.json', kind: 'lockfile' },
        {
          file: 'package-lock.json',
          how: 'installed again with `npm install`: the branch changed package.json since the base',
        },
      ],
    });

    expect(read(root, 'package-lock.json')).toContain('"version": "1.1.0"');
    expect(git(root, 'status', '--porcelain').trim()).toBe('');
  }, 60_000);

  it('gives the next free number to a decision record of the branch whose number the trunk took meanwhile', () => {
    const record = (number: string, title: string): string => `# ADR-${number}: ${title}\n\n- Status: accepted\n`;
    const root = trunkRepository({ 'docs/adr/0001-issue-invoices.md': record('0001', 'Issue invoices') });

    onBranch(root, 'build/billing');

    commitFiles(
      root,
      {
        'docs/adr/0002-pay-by-card.md': record('0002', 'Pay by card'),
        'docs/adr/0002-pay-by-card.fr.md': '[English](0002-pay-by-card.md)\n\n# ADR-0002 : Payer par carte\n',
      },
      'feat(billing): pay',
    );

    onBranch(root, 'main');

    commitFiles(
      root,
      { 'docs/adr/0002-cancel-invoices.md': record('0002', 'Cancel invoices') },
      'feat(billing): cancel (#3)',
    );

    onBranch(root, 'build/billing');

    const result = mergeTrunk(root, '--json');

    expect(result.json()).toMatchObject({
      status: 'committed',
      automatic: [
        { file: 'docs/adr/0003-pay-by-card.fr.md', kind: 'adr' },
        { file: 'docs/adr/0003-pay-by-card.md', kind: 'adr' },
      ],
    });

    expect(read(root, 'docs/adr/0003-pay-by-card.md')).toBe(record('0003', 'Pay by card'));
    expect(read(root, 'docs/adr/0003-pay-by-card.fr.md')).toContain('[English](0003-pay-by-card.md)');
    expect(exists(root, 'docs/adr/0002-pay-by-card.md')).toBe(false);
    expect(exists(root, 'docs/adr/0002-cancel-invoices.md')).toBe(true);

    expect(lastMessage(root)).toContain(
      'Lost-Accepted: docs/adr/0002-pay-by-card.fr.md:1, docs/adr/0002-pay-by-card.fr.md:3, docs/adr/0002-pay-by-card.md:1',
    );
  });
});
