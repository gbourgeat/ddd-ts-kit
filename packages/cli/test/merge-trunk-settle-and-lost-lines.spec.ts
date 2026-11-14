import { describe, expect, it } from 'vitest';
import { read, write } from './helpers';
import { git } from './support/git';
import { INDEX, store } from './support/index-invariant';
import { goOn, merging, mergeTrunk } from './support/trunk-history';
import { twoSides } from './support/two-sides';

/** Each conflict of a file resolved by keeping our side only: what a careless resolution does. */
function keepOursOnly(root: string): void {
  for (const file of git(root, 'diff', '--name-only', '--diff-filter=U')
    .split('\n')
    .filter((path) => path !== '')) {
    let side: 'ours' | 'base' | 'theirs' | undefined;

    const kept = read(root, file)
      .split('\n')
      .filter((line) => {
        const marker = /^(<{7}|\|{7}|={7}|>{7})/.exec(line)?.[1];

        side =
          marker === undefined
            ? side
            : marker.startsWith('<')
              ? 'ours'
              : marker.startsWith('|')
                ? 'base'
                : marker.startsWith('=')
                  ? 'theirs'
                  : undefined;

        return marker === undefined && (side === undefined || side === 'ours');
      });

    write(root, file, kept.join('\n'));
  }

  git(root, 'add', '--all');
}

/**
 * A line each side adds at the end of a file, one name each: the two conflict. On Drizzle the file is
 * the index; on TypeORM, where a line the kit did not write keeps it from settling the index, it is
 * a module of the team beside it.
 */
function appended(project: string, orm: string, line: string): void {
  const file = orm === 'typeorm' ? 'src/legacy.ts' : INDEX;
  const held = orm === 'typeorm' ? '' : read(project, file);

  write(project, file, `${held}${line}\n`);
}

describe.each(['drizzle', 'typeorm'])('merge-trunk on %s, a settle in a merge that lost a line of the trunk', (orm) => {
  it("stops on the line the resolution lost, as on main: the lines the kit wrote are never the merge's own", () => {
    const root = twoSides({
      orm,
      trunk: (project) => {
        store(project, 'billing', 'Order');
        appended(project, orm, 'export const legacyTrunk = [outbox];');
      },
      branch: (project) => {
        store(project, 'shipping', 'Order');
        store(project, 'returns', 'Order');
        appended(project, orm, 'export const legacyBranch = [outbox];');
      },
    });

    const started = mergeTrunk(root);

    expect(merging(root), started.stdout).toBe(true);
    keepOursOnly(root);

    const continued = goOn(root, '--continue');

    expect(merging(root), continued.stdout).toBe(true);
    expect(continued.stdout).toMatch(/lost lines: \d+ error/);
    expect(continued.stdout).toContain('export const legacyTrunk = [outbox];');
    // A line the settle took out is accepted by its file, its side and its text; the lines it wrote are named apart.
    goOn(root, '--continue');

    const message = read(root, '.git/MERGE_MSG');

    const entries = (key: string): string[] =>
      [...message.matchAll(new RegExp(`^${key}:(.*)$`, 'gm'))].flatMap(([, held = '']) =>
        held.split(/[\s,]+/).filter((entry) => entry !== ''),
      );

    expect(entries('Kit-Written').length).toBeGreaterThan(0);
    expect(entries('Lost-Accepted').length).toBeGreaterThan(0);
    expect(entries('Lost-Accepted').every((entry) => /@(?:ours|theirs|both)#[0-9a-f]{12}$/.test(entry))).toBe(true);
    expect(new Set(entries('Kit-Written')).size).toBe(entries('Kit-Written').length);
    expect(new Set(entries('Lost-Accepted')).size).toBe(entries('Lost-Accepted').length);
  });
});
