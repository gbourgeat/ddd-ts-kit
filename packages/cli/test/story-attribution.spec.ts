import { describe, expect, it } from 'vitest';
import type { Remaining } from '../src/progress/remaining';
import { attributeMarkers } from '../src/story/attribute-markers';
import { tempDir, write } from './helpers';

const IDS = ['M1.01', 'M1.02', 'US2.01'];
const INVOICE = 'src/contexts/billing/domain/invoice.aggregate.ts';
const SPEC = 'src/contexts/billing/test/unit/invoice.aggregate.spec.ts';
const FIRST = 'a'.repeat(40);
const SECOND = 'b'.repeat(40);
const NOT_COMMITTED = '0'.repeat(40);

const marker = (file: string, line: number, text = 'settle it'): Remaining => ({
  kind: 'test',
  context: 'billing',
  file,
  line,
  text,
});

/** A git that answers blame and show as a repository would, and records each call. */
function fakeGit(blames: Readonly<Record<string, Readonly<Record<number, string>>>>) {
  const calls: string[][] = [];

  const git = (_directory: string, args: readonly string[]): string | undefined => {
    calls.push([...args]);

    if (args[0] === 'blame') {
      const lines = blames[args.at(-1) ?? ''] ?? {};

      return Object.entries(lines)
        .map(([line, sha]) => `${sha} ${line} ${line} 1\nauthor Test\n\tcode\n`)
        .join('');
    }

    if (args[0] === 'show') {
      return `${FIRST}\x1fM1.01\x1ffeat(billing): issue invoice\n\nSlice: M1.01\n\x1e\n${SECOND}\x1f\x1ffeat(billing): cancel invoice (US2.01)\n\x1e\n`;
    }

    return 'true\n';
  };

  return { git, calls };
}

describe('the rows a marker belongs to', () => {
  it('are named by its text, else by the commit that wrote it, with one blame per file and one show', () => {
    const root = tempDir('attribution');

    const lines = Object.fromEntries(
      Array.from({ length: 40 }, (_, index) => [index + 1, index % 2 === 0 ? FIRST : SECOND]),
    );

    const { git, calls } = fakeGit({ [SPEC]: lines, [INVOICE]: { 7: NOT_COMMITTED } });

    const markers = [
      ...Array.from({ length: 40 }, (_, index) => marker(SPEC, index + 1)),
      marker(INVOICE, 3, '#M1.02 rename the total'),
      marker(INVOICE, 7),
    ];

    const attributed = attributeMarkers(root, markers, { ids: IDS, git });

    expect(calls.map((args) => args[0])).toEqual(['blame', 'blame', 'show']);
    expect(calls[0]?.filter((arg) => arg === '-L')).toHaveLength(40);
    expect(calls[2]?.slice(3)).toEqual([FIRST, SECOND]);

    expect(attributed[0]?.attribution).toEqual({
      by: 'commit',
      rows: ['M1.01'],
      commit: { sha: 'aaaaaaa', trailer: true },
    });

    expect(attributed[1]?.attribution).toEqual({
      by: 'commit',
      rows: ['US2.01'],
      commit: { sha: 'bbbbbbb', trailer: false },
    });

    expect(attributed[40]?.attribution).toEqual({ by: 'text', rows: ['M1.02'] });
    expect(attributed[41]?.attribution).toEqual({ by: 'none', rows: [] });
  });

  it('are the rows of the worker for a line not committed in its worktree', () => {
    const root = tempDir('attribution');

    write(root, '.ddd-ts-kit/worker.json', JSON.stringify({ context: 'billing', rows: ['US2.01', 'US9.01'] }));

    const { git } = fakeGit({ [INVOICE]: { 7: NOT_COMMITTED } });
    const [attributed] = attributeMarkers(root, [marker(INVOICE, 7)], { ids: IDS, git });

    expect(attributed?.attribution).toEqual({ by: 'worker', rows: ['US2.01'] });
  });

  it('counts a file git cannot blame as not committed inside a repository, as unknown outside', () => {
    const root = tempDir('attribution');

    write(root, '.ddd-ts-kit/worker.json', JSON.stringify({ context: 'billing', rows: ['M1.02'] }));

    const answers = (inside: string) => (_directory: string, args: readonly string[]) =>
      args[0] === 'rev-parse' ? inside : undefined;

    expect(attributeMarkers(root, [marker(INVOICE, 7)], { ids: IDS, git: answers('true\n') })[0]?.attribution).toEqual({
      by: 'worker',
      rows: ['M1.02'],
    });

    expect(attributeMarkers(root, [marker(INVOICE, 7)], { ids: IDS, git: answers('false\n') })[0]?.attribution).toEqual(
      {
        by: 'none',
        rows: [],
      },
    );
  });
});
