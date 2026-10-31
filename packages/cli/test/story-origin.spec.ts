import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cli, write } from './helpers';
import { committedProject } from './support/committed-project';
import { jsonAt } from './support/json-at';
import { type StubInstallers, stubInstallers } from './support/stub-installers';

let root: string;
let installers: StubInstallers;

beforeAll(() => {
  installers = stubInstallers();
  root = committedProject('shop', '--context', 'ordering:core');
});

afterAll(() => installers.restore());

const INTENT = `# Intent: Faster checkout

Author: J. Ortiz (product). Status: draft.

## Problem

A customer waits.

## Acceptance, as the author would observe it

- a customer pays in one step
`;

const FIX = `# FIX1 A paid order can be paid again

## Origin

- From: incident \`docs/architecture/incidents/INC-2026-10-18-checkout.md\`
- Built with: ddd-ts-kit 0.85.0, plugin 0.85.0, on \`main\` at \`0000000\`

## Statement

A paid order could be paid a second time.

## Regression

- test/unit/order.aggregate.spec.ts
`;

describe('story-scope --from and --kind', () => {
  it('refuses an intent that is not accepted, a file that is neither an intent nor an incident, and an unknown kind', () => {
    write(root, 'docs/architecture/intents/faster-checkout.md', INTENT);
    write(root, 'docs/backlog/us7.md', 'A customer pays in one step.');

    const draft = cli(
      root,
      'story-scope',
      'US7',
      '--from',
      'docs/architecture/intents/faster-checkout.md',
      '--dry-run',
    );

    expect(draft.code).not.toBe(0);
    expect(draft.stderr).toContain('docs/architecture/intents/faster-checkout.md is not an accepted intent.');
    expect(draft.stderr).toContain('Status: accepted');

    expect(cli(root, 'story-scope', 'US7', '--from', 'docs/backlog/us7.md', '--dry-run').stderr).toContain(
      'docs/backlog/us7.md is neither an intent nor an incident record.',
    );

    expect(cli(root, 'story-scope', 'US7', '--from', 'docs/backlog/none.md', '--dry-run').stderr).toContain(
      'docs/backlog/none.md does not exist.',
    );

    expect(cli(root, 'story-scope', 'US7', '--kind', 'bug', '--dry-run').stderr).toContain('Unknown kind "bug".');
  });

  it('records an accepted intent as the origin of a story, and says the story skill seeds the statement from it', () => {
    write(root, 'docs/architecture/intents/faster-checkout.md', INTENT.replace('Status: draft.', 'Status: accepted.'));

    const opened = cli(root, 'story-scope', 'US7', '--from', 'docs/architecture/intents/faster-checkout.md');

    expect(opened.code).toBe(0);
    expect(opened.stdout).toContain('base main, from docs/architecture/intents/faster-checkout.md)');

    expect(opened.stdout).toContain('Next: work from the worktree, every command `cd ');

    expect(opened.stdout).toContain(
      'the story skill seeds the statement of docs/architecture/stories/US7.md from docs/architecture/intents/faster-checkout.md;',
    );

    const us7 = path.join(fs.realpathSync(root), '.worktrees', 'us7');

    expect(JSON.parse(fs.readFileSync(path.join(us7, '.ddd-ts-kit/story.json'), 'utf8'))).toMatchObject({
      story: 'US7',
      kind: 'story',
      from: 'docs/architecture/intents/faster-checkout.md',
    });

    const resumed = cli(root, 'story-scope', 'US7', '--json').json();

    expect(resumed).toMatchObject({
      created: false,
      kind: 'story',
      from: 'docs/architecture/intents/faster-checkout.md',
      seeds: true,
    });
  });

  it('opens a fix from an incident record, whose phases read ## Regression instead of the acceptance', () => {
    write(root, 'docs/architecture/incidents/INC-2026-10-18-checkout.md', '# Incident: a paid order paid again\n');

    const opened = cli(
      root,
      'story-scope',
      'FIX1',
      '--kind',
      'fix',
      '--from',
      'docs/architecture/incidents/INC-2026-10-18-checkout.md',
      '--json',
    ).json();

    expect(opened).toMatchObject({ kind: 'fix', from: 'docs/architecture/incidents/INC-2026-10-18-checkout.md' });

    const fix = path.join(fs.realpathSync(root), '.worktrees', 'fix1');

    expect(JSON.parse(fs.readFileSync(path.join(fix, '.ddd-ts-kit/story.json'), 'utf8'))).toMatchObject({
      story: 'FIX1',
      kind: 'fix',
      from: 'docs/architecture/incidents/INC-2026-10-18-checkout.md',
    });

    expect(cli(fix, 'story', '--gate', 'build').stdout).toMatch(
      /\[ \] specification +no docs\/architecture\/stories\/FIX1\.md/,
    );

    write(fix, 'docs/architecture/stories/FIX1.md', FIX);

    const listed = cli(fix, 'story', '--gate', 'build');

    expect(listed.code).toBe(1);

    expect(listed.stdout).toMatch(
      /\[x\] specification +docs\/architecture\/stories\/FIX1\.md, 0 acceptance criteria, a fix/,
    );

    expect(listed.stdout).toMatch(/\[x\] rows +no row, optional for a fix/);
    expect(listed.stdout).toMatch(/\[x\] design review +no row to design, optional for a fix/);

    expect(listed.stdout).toMatch(
      /\[ \] regression specs listed +`## Regression` lists test\/unit\/order\.aggregate\.spec\.ts, which does not exist/,
    );

    expect(listed.stdout).toContain('Next: List the regression specs of FIX1 under `## Regression`');

    write(
      fix,
      'test/unit/order.aggregate.spec.ts',
      "import { it } from 'vitest';\n\nit.todo('refuses a second payment');\n",
    );

    const built = cli(fix, 'story', '--gate', 'build', '--json').json();

    expect(built).toMatchObject({ met: true });
    expect(jsonAt(built, 'phases')).not.toContainEqual(expect.objectContaining({ id: 'passing' }));

    expect(jsonAt(built, 'phases')).toContainEqual(
      expect.objectContaining({ id: 'acceptance', met: true, detail: '`## Regression` lists 1 spec' }),
    );

    expect(jsonAt(built, 'phases')).toContainEqual(
      expect.objectContaining({
        id: 'built',
        met: true,
        detail: 'no row, optional for a fix: the fix is built in its commits',
      }),
    );
  });
});

describe('story-scope --from with the template of the intent skill', () => {
  it('refuses the template of the intent skill with Status: draft, whose comment says Status: accepted', () => {
    const template = fs.readFileSync(
      path.resolve(__dirname, '../../../plugin/skills/story/intent-template.md'),
      'utf8',
    );

    write(
      root,
      'docs/architecture/intents/from-template.md',
      template.replace(/^Author: .*/m, 'Author: Ann (PO). Status: draft.'),
    );

    const draft = cli(root, 'story-scope', 'US8', '--from', 'docs/architecture/intents/from-template.md', '--dry-run');

    expect(draft.code).not.toBe(0);
    expect(draft.stderr).toContain('is not an accepted intent.');
  });
});
