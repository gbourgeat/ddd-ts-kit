import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runGit } from '../src/commit/run-git';
import { cli, tempDir } from './helpers';
import { commitFiles } from './support/commit-files';
import { git } from './support/git';
import { measuresOf, storyOf } from './support/measured-stories';

const STORY = 'docs/architecture/stories/US1.md';
const OPEN = '# US1 Declare\n\n## Acceptance criteria\n\n- AC1: declared\n\n## Report\n';
const DONE = `${OPEN}done, verified.\n`;

function repository(): string {
  const root = path.join(fs.realpathSync(tempDir('measures-close')), 'shop');

  fs.mkdirSync(root);
  git(root, 'init', '--quiet', '--initial-branch', 'main');

  commitFiles(root, {
    message: 'chore: bootstrap',
    at: '2026-03-01T09:00:00Z',
    files: { 'ddd-ts-kit.config.json': '{}\n', [STORY]: OPEN },
  });

  git(root, 'switch', '--quiet', '--create', 'story/us1');

  commitFiles(root, {
    message: 'feat(a): work\n\nSlice: US1.01',
    at: '2026-03-02T09:00:00Z',
    files: { 'a.ts': 'a\n' },
  });

  return root;
}

function trunkMovesAndIsMergedIn(root: string): void {
  git(root, 'switch', '--quiet', 'main');
  commitFiles(root, { message: 'chore: trunk moves', at: '2026-03-03T09:00:00Z', files: { 'trunk.txt': 't\n' } });
  git(root, 'switch', '--quiet', 'story/us1');
  process.env.GIT_COMMITTER_DATE = '2026-03-04T09:00:00Z';
  git(root, 'merge', '--quiet', '--no-ff', '-m', 'Merge main into story/us1', 'main');
  Reflect.deleteProperty(process.env, 'GIT_COMMITTER_DATE');
  commitFiles(root, { message: 'docs(story): US1 report', at: '2026-03-05T09:00:00Z', files: { [STORY]: DONE } });
  git(root, 'switch', '--quiet', 'main');
}

describe('ddd-ts-kit measures: the close of a story is the commit that lands its last commit', () => {
  it('takes a merge of another subject, not the merge of the trunk into the story branch', () => {
    const root = repository();

    trunkMovesAndIsMergedIn(root);
    process.env.GIT_COMMITTER_DATE = '2026-03-06T09:00:00Z';
    git(root, 'merge', '--quiet', '--no-ff', '-m', 'feat(incidents): story US1, declare an incident', 'story/us1');
    Reflect.deleteProperty(process.env, 'GIT_COMMITTER_DATE');

    const us1 = storyOf(measuresOf(root), 'US1');

    expect(us1.leadHours).toBe(120);
    expect(us1.merged).toBe(git(root, 'rev-parse', '--short=7', 'HEAD').trim());
  });

  it('takes a squash merge, which does not name the branch', () => {
    const root = repository();

    git(root, 'switch', '--quiet', 'main');
    git(root, 'merge', '--quiet', '--squash', 'story/us1');

    commitFiles(root, {
      message: 'feat: declare an incident (#7)',
      at: '2026-03-07T09:00:00Z',
      files: { [STORY]: DONE },
    });

    const us1 = storyOf(measuresOf(root), 'US1');

    expect(us1.leadHours).toBe(144);
    expect(us1.merged).toBe(git(root, 'rev-parse', '--short=7', 'HEAD').trim());
  });

  it('leaves a story whose branch is not merged open', () => {
    const root = repository();

    trunkMovesAndIsMergedIn(root);

    expect(storyOf(measuresOf(root), 'US1').leadHours).toBeUndefined();
  });
});

describe('ddd-ts-kit measures: a history larger than the default buffer', () => {
  it('reads it, and says so when git cannot answer instead of measuring nothing', () => {
    const root = repository();

    commitFiles(root, { message: 'chore: a store', files: { 'store.txt': `${'x'.repeat(79)}\n`.repeat(20_000) } });

    expect(runGit(root, ['show', 'HEAD:store.txt'])?.length).toBeGreaterThan(1_500_000);
    expect(() => runGit(root, ['log', '--format=%H', '-n', '1', '--bogus-option-that-is-not-a-status'])).not.toThrow();
    expect(cli(root, 'measures', '--json').code).toBe(0);
  });

  it('names the earliest of the incidents a story repeats, and none for an origin outside the incident records', () => {
    const root = repository();
    const incident = (code: string): string => `---\nerror_code: ${code}\n---\n# Incident\n`;

    const story = (origin: string): string =>
      `# US2 Fix\n\n## Origin\n\n${origin}\n\n## Acceptance criteria\n\n- AC1: fixed\n\n## Report\n`;

    git(root, 'switch', '--quiet', 'main');

    commitFiles(root, {
      message: 'docs(incidents): inc-1',
      at: '2026-03-02T09:00:00Z',
      files: { 'docs/architecture/incidents/inc-1.md': incident('SLOT_TAKEN') },
    });

    commitFiles(root, {
      message: 'docs(incidents): inc-2',
      at: '2026-03-03T09:00:00Z',
      files: { 'docs/architecture/incidents/inc-2.md': incident('SLOT_TAKEN') },
    });

    commitFiles(root, {
      message: 'docs(story): US2 from inc-3, US3 from elsewhere',
      at: '2026-03-04T09:00:00Z',
      files: {
        'docs/architecture/incidents/inc-3.md': incident('SLOT_TAKEN'),
        'docs/architecture/stories/US2.md': story('Incident docs/architecture/incidents/inc-3.md.'),
        'docs/architecture/stories/US3.md': story('Incident docs/architecture/incidents/inc-9.md, never written.'),
      },
    });

    const view = measuresOf(root);

    expect(storyOf(view, 'US2').repeatIncident).toBe('docs/architecture/incidents/inc-1.md');
    expect(storyOf(view, 'US3').repeatIncident).toBeUndefined();
  });

  it('says that git could not be read when it is on the PATH and cannot be run, never that it answered nothing', () => {
    const root = repository();
    const bin = tempDir('measures-close-bin');
    const previous = process.env['PATH'];

    fs.writeFileSync(path.join(bin, 'git'), '#!/bin/sh\n', { mode: 0o644 });
    process.env['PATH'] = bin;

    try {
      expect(() => runGit(root, ['log', '--format=%H', '-n', '1'])).toThrow('git log could not be read: EACCES.');
    } finally {
      process.env['PATH'] = previous;
    }
  });
});
