import { rmSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers';
import { BUILT, LOCK, SLICES, SPEC, SPECIFICATION, STORY } from './support/acceptance-story';
import { git } from './support/git';
import { initProject } from './support/init-project';
import { jsonAt } from './support/json-at';

const PLACES = '#US5.02 AC1 a customer places an order and reads its number';

/** A project with the story written and locked, committed or not, then its lock deleted and a scenario changed. */
function removedLock(committed: boolean): string {
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

  rmSync(path.join(root, LOCK));
  write(root, SPEC, BUILT.replace('201);\n  });\n\n  it(', '200);\n  });\n\n  it('));

  return root;
}

function fingerprintOfPlaces(root: string): string {
  const [story] = jsonAt(cli(root, 'acceptance', 'US5', '--json').json(), 'stories') as Array<Record<string, unknown>>;
  const scenarios = (story?.['scenarios'] ?? []) as Array<Record<string, string>>;

  return scenarios.find((scenario) => scenario['title'] === PLACES)?.['fingerprint'] ?? 'none';
}

describe('the lock of an acceptance, removed then locked again', () => {
  let root: string;

  beforeAll(() => {
    root = removedLock(true);
  });

  it('refuses to lock a scenario that changed since the last committed lock, naming it', () => {
    const refused = cli(root, 'acceptance', 'US5', '--lock');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain(`The lock of US5 was removed, and changed since the last commit of it`);
    expect(refused.stderr).toContain(`scenario "${PLACES}" (fingerprint ${fingerprintOfPlaces(root)})`);

    expect(refused.stderr).toContain(
      `Restore it (\`git checkout -- ${LOCK}\`), then let the acceptance-judge agent rule`,
    );

    expect(() => read(root, LOCK)).toThrow();
  });

  it('locks it when the judge let that very version through, the verdict kept as an amendment', () => {
    write(
      root,
      'test/acceptance/verdicts/us5-amended.md',
      `# Verdict\n\nStory: US5\nSubject: scenario "${PLACES}"\nFingerprint: ${fingerprintOfPlaces(root)}\nVerdict: amend\nReason: a 200 with the order answers AC1\n`,
    );

    const locked = cli(root, 'acceptance', 'US5', '--lock');

    expect(locked.code).toBe(0);
    expect(locked.stdout).toContain('Amended by test/acceptance/verdicts/us5-amended.md');
    expect(JSON.parse(read(root, LOCK))).toMatchObject({ amendments: [{ subject: `scenario "${PLACES}"` }] });
  });

  it('locks a story whose lock was never committed, nothing being there to compare with', () => {
    const fresh = removedLock(false);

    git(fresh, 'init', '-q');

    expect(cli(fresh, 'acceptance', 'US5', '--lock').code).toBe(0);
  });

  it('locks outside a git repository and says the previous lock could not be checked', () => {
    const outside = removedLock(false);
    const locked = cli(outside, 'acceptance', 'US5', '--lock');

    expect(locked.code).toBe(0);
    expect(locked.stdout).toContain('The previous lock of US5 could not be checked: this is not a git repository.');
  });
});
