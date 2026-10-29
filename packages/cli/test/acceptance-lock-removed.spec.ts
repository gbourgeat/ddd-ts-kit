import { rmSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers';
import { BUILT, LOCK, SLICES, SPEC, SPECIFICATION, STORY } from './support/acceptance-story';
import { git } from './support/git';
import { initProject } from './support/init-project';
import { jsonAt } from './support/json-at';

const PLACES = '#US5.02 AC1 a customer places an order and reads its number';

type Damage = 'delete' | 'empty' | 'unparsable';

/** A project with the story written and locked, committed or not, then its lock damaged and a scenario changed. */
function damagedLock(committed: boolean, damage: Damage = 'delete'): string {
  const root = initProject('--context', 'ordering:core', '--context', 'billing:supporting');

  write(root, 'docs/architecture/slices.md', SLICES);
  write(root, STORY, SPECIFICATION);
  write(root, SPEC, BUILT);

  expect(cli(root, 'acceptance', 'US5', '--lock').code).toBe(0);

  if (committed) {
    git(root, 'init', '-q');
    git(root, 'add', '.');
    git(root, 'commit', '-q', '-m', 'the project');
  }

  if (damage === 'delete') {
    rmSync(path.join(root, LOCK));
  } else {
    write(root, LOCK, damage === 'empty' ? '{}\n' : '{ not json');
  }

  write(root, SPEC, BUILT.replace('201);\n  });\n\n  it(', '200);\n  });\n\n  it('));

  return root;
}

function amend(root: string): void {
  write(
    root,
    'test/acceptance/verdicts/us5-amended.md',
    `# Verdict\n\nStory: US5\nSubject: scenario "${PLACES}"\nFingerprint: ${fingerprintOfPlaces(root)}\nVerdict: amend\nReason: a 200 with the order answers AC1\n`,
  );
}

function fingerprintOfPlaces(root: string): string {
  const [story] = jsonAt(cli(root, 'acceptance', 'US5', '--json').json(), 'stories') as Array<Record<string, unknown>>;
  const scenarios = (story?.['scenarios'] ?? []) as Array<Record<string, string>>;

  return scenarios.find((scenario) => scenario['title'] === PLACES)?.['fingerprint'] ?? 'none';
}

describe('the lock of an acceptance, removed then locked again', () => {
  let root: string;

  beforeAll(() => {
    root = damagedLock(true);
  });

  it('lists the drift in the report, with its subject and fingerprint, while the lock is deleted', () => {
    const report = cli(root, 'acceptance', 'US5');

    expect(report.code).toBe(1);
    expect(report.stdout).toContain(`The lock of US5 was removed or emptied: restore it (\`git checkout `);
    expect(report.stdout).toContain(`The scenario "${PLACES}" changed since the lock, and no verdict lets it through`);
    expect(report.stdout).toContain(`at fingerprint ${fingerprintOfPlaces(root)}`);
  });

  it('refuses to lock a scenario that changed since the last committed lock, naming it and the commit', () => {
    const refused = cli(root, 'acceptance', 'US5', '--lock');
    const commit = git(root, 'rev-parse', '--short=8', 'HEAD').trim();

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('The lock of US5 was removed or emptied, and changed since its last commit');
    expect(refused.stderr).toContain(`scenario "${PLACES}" (fingerprint ${fingerprintOfPlaces(root)})`);

    expect(refused.stderr).toContain(
      `Restore it (\`git checkout ${commit} -- ${LOCK}\`), then let the acceptance-judge agent rule`,
    );

    expect(() => read(root, LOCK)).toThrow();
  });

  it('locks it when the judge let that very version through, the verdict kept as an amendment', () => {
    amend(root);

    const locked = cli(root, 'acceptance', 'US5', '--lock');

    expect(locked.code).toBe(0);
    expect(locked.stdout).toContain('Amended by test/acceptance/verdicts/us5-amended.md');
    expect(JSON.parse(read(root, LOCK))).toMatchObject({ amendments: [{ subject: `scenario "${PLACES}"` }] });
  });

  it.each(['empty', 'unparsable'] as const)('refuses the same when the lock is %s', (damage) => {
    const damaged = damagedLock(true, damage);
    const refused = cli(damaged, 'acceptance', 'US5', '--lock');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain(`scenario "${PLACES}" (fingerprint ${fingerprintOfPlaces(damaged)})`);

    amend(damaged);

    expect(cli(damaged, 'acceptance', 'US5', '--lock').code).toBe(0);
  });

  it('locks without refusal when a commit deleted the lock, and says so', () => {
    const decided = damagedLock(true);

    git(decided, 'add', '-A');
    git(decided, 'commit', '-q', '-m', 'reopen the story');

    const locked = cli(decided, 'acceptance', 'US5', '--lock');

    expect(locked.code).toBe(0);

    expect(locked.stdout).toMatch(
      /The lock of US5 was removed by the commit [0-9a-f]{8}: locked again without comparison\./,
    );
  });

  it('locks a story whose lock was never committed, nothing being there to compare with', () => {
    const fresh = damagedLock(false);

    git(fresh, 'init', '-q');

    const locked = cli(fresh, 'acceptance', 'US5', '--lock');

    expect(locked.code).toBe(0);
    expect(locked.stdout).not.toContain('could not be checked');
  });

  it('locks outside a git repository, and says the previous lock could not be checked only when a removal is plausible', () => {
    const note =
      'The previous lock of US5 could not be checked: git did not answer (no repository, or git not installed).';

    const deleted = cli(damagedLock(false), 'acceptance', 'US5', '--lock');

    expect(deleted.code).toBe(0);
    expect(deleted.stdout).not.toContain('could not be checked');

    const unparsable = cli(damagedLock(false, 'unparsable'), 'acceptance', 'US5', '--lock');

    expect(unparsable.code).toBe(0);
    expect(unparsable.stdout).toContain(note);

    const judged = damagedLock(false);

    amend(judged);

    expect(cli(judged, 'acceptance', 'US5', '--lock').stdout).toContain(note);
  });
});
