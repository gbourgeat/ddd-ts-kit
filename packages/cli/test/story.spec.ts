import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cli, write } from './helpers.js';
import { committedProject } from './support/committed-project.js';
import { git } from './support/git.js';
import { jsonAt } from './support/json-at.js';
import { type StubInstallers, stubInstallers } from './support/stub-installers.js';

const SLICES = `# Slices

| # | Context | Kind | Slice | Start with | Depends on | Owner | Status |
|---|---|---|---|---|---|---|---|
| US5.01 | ordering | skeleton | Order | \`generate aggregate ordering Order\` | | conductor | todo |
| US5.02 | ordering | slice | Place order | \`generate command ordering PlaceOrder --aggregate Order --permission order.place\` | US5.01 | ordering | todo |
| US6.01 | billing | slice | Issue invoice | \`generate command billing IssueInvoice --permission invoice.issue\` | | billing | todo |
`;

const SPECIFICATION = `# US5 Place an order

## Origin

- From: ticket \`SHOP-412\`
- Built with: ddd-ts-kit 0.85.0, plugin 0.85.0, on \`main\` at \`0000000\`
- Policies in force: \`ddd-ts-kit:access-control\`

## Questions

- Who may place an order? A customer (answered by the owner).

## Acceptance criteria

- AC1: a customer places an order and reads its number
`;

const REVIEW = `# Design review of US5

## #US5.01 Order

\`Order\` holds its lines.

## #US5.02 Place order

\`PlaceOrderCommand\` with the permission \`order.place\`.
`;

const SCENARIOS = `import { it } from 'vitest';
import { expectStatus, pending } from '@ddd-ts-kit/testing/e2e';

it('#US5.02 AC1 a customer places an order and reads its number', pending(async () => {
  expectStatus({ status: 404, headers: {}, body: undefined }, 201);
}));
`;

/** Deletes each line holding a marker `story-check` says keeps the story open: what the session settles before it closes. */
function settleMarkers(directory: string, code: string): void {
  const markers = jsonAt(cli(directory, 'story-check', code, '--json').json(), 'markers') as Array<{
    file: string;
    line: number;
  }>;

  for (const { file, line } of [...markers].sort((left, right) => right.line - left.line)) {
    const lines = fs.readFileSync(path.join(directory, file), 'utf8').split('\n');

    lines.splice(line - 1, 1);
    fs.writeFileSync(path.join(directory, file), lines.join('\n'));
  }
}

let root: string;
let story: string;
let installers: StubInstallers;

beforeAll(() => {
  installers = stubInstallers();
  root = committedProject('shop', '--context', 'ordering:core', '--context', 'billing:supporting');
  story = path.join(fs.realpathSync(root), '.worktrees', 'us5');
  write(root, 'docs/architecture/slices.md', SLICES);
  git(root, 'add', '--all');
  git(root, 'commit', '--quiet', '--message', 'docs: plan US5 and US6');
});

afterAll(() => installers.restore());

describe('story-scope', () => {
  it('refuses what is not the code of a story', () => {
    expect(cli(root, 'story-scope', 'US5.02').stderr).toContain('"US5.02" is not the code of a story.');
  });

  it('with --dry-run says where the story would go and creates nothing', () => {
    const planned = cli(root, 'story-scope', 'US5', '--dry-run', '--json').json();

    expect(planned).toMatchObject({ dryRun: true, story: 'US5', branch: 'story/us5', base: 'main', created: true });
    expect(fs.existsSync(story)).toBe(false);
  });

  it('opens the worktree of the story on its branch, with its file and its dependencies', () => {
    const opened = cli(root, 'story-scope', 'US5');

    expect(opened.code).toBe(0);
    expect(opened.stdout).toContain(`worktree created: ${story} (branch story/us5, base main)`);
    expect(opened.stdout).toContain(`Next: work from the worktree, every command \`cd ${story} && ...\``);
    expect(git(story, 'branch', '--show-current').trim()).toBe('story/us5');

    expect(JSON.parse(fs.readFileSync(path.join(story, '.ddd-ts-kit/story.json'), 'utf8'))).toMatchObject({
      story: 'US5',
      base: 'main',
      baseCommit: git(root, 'rev-parse', 'main').trim(),
      branch: 'story/us5',
    });

    expect(installers.calls().at(-1)).toMatch(/^pnpm install --frozen-lockfile in .*\.worktrees\/us5$/);
  });

  it('finds the story again where it was left, without installing twice', () => {
    const calls = installers.calls().length;

    expect(cli(root, 'story-scope', 'US5').stdout).toContain(`worktree kept, the story resumes: ${story}`);
    expect(installers.calls()).toHaveLength(calls);
  });

  it('refuses the same story in a second worktree, and a story cut from the branch of another', () => {
    const elsewhere = cli(root, 'story-scope', 'US5', '--worktree', '../shop-us5-again');

    expect(elsewhere.code).not.toBe(0);
    expect(elsewhere.stderr).toContain(`US5 is already open in ${story}`);
    expect(cli(story, 'story-scope', 'US6').stderr).toContain('is the worktree of the story US5');
  });

  it('names the other stories open in the repository and the contexts they change', () => {
    const second = cli(root, 'story-scope', 'US6', '--json');

    expect(jsonAt(second.json(), 'others')).toEqual([
      expect.objectContaining({ story: 'US5', worktree: story, branch: 'story/us5', contexts: ['ordering'] }),
    ]);
  });
});

describe('worker-scope --here', () => {
  it('refuses outside the worktree of a story', () => {
    expect(cli(root, 'worker-scope', 'ordering', '--here').stderr).toContain(
      '--here briefs a worker inside the worktree of a story',
    );
  });

  it('confines the next agent to its context in the worktree of the story, against the base of the story', () => {
    const scoped = cli(story, 'worker-scope', 'ordering', '--here', '--rows', 'US5.02', '--json');

    expect(scoped.code).toBe(0);
    expect(scoped.json()).toMatchObject({ created: false, branch: 'story/us5', trunk: 'main' });

    expect(JSON.parse(fs.readFileSync(path.join(story, '.ddd-ts-kit/worker.json'), 'utf8'))).toMatchObject({
      context: 'ordering',
      rows: ['US5.02'],
      base: 'main',
      branch: 'story/us5',
    });

    expect(String(jsonAt(scoped.json(), 'briefing'))).toContain('#US5.02');
  });

  it('finds the agent of the story again where it stopped, in the worktree of the story', () => {
    const resumed = cli(story, 'worker-scope', 'ordering', '--resume', '--worktree', '.', '--json');

    expect(resumed.code).toBe(0);
    expect(fs.realpathSync(String(jsonAt(resumed.json(), 'worktree')))).toBe(story);
  });
});

describe('story', () => {
  it('starts with the specification, and holds the build gate', () => {
    const report = cli(story, 'story', '--gate', 'build');

    expect(report.code).toBe(1);
    expect(report.stdout).toMatch(/^US5\n {2}\[ \] specification +no docs\/architecture\/stories\/US5\.md$/m);
    expect(report.stdout).toMatch(/\[x\] rows +2 rows in docs\/architecture\/slices\.md/);
    expect(report.stdout).toContain('Next: Write docs/architecture/stories/US5.md');
    expect(report.stdout).toContain('gate build: not met');
  });

  it('asks for a design review section per row not done', () => {
    write(story, 'docs/architecture/stories/US5.md', SPECIFICATION);
    write(story, 'docs/architecture/reviews/US5.md', REVIEW.replace(/## #US5\.02[^]*$/, ''));

    const report = cli(story, 'story', '--json').json();

    expect(jsonAt(report, 'phases')).toContainEqual(
      expect.objectContaining({
        id: 'design',
        met: false,
        detail: 'docs/architecture/reviews/US5.md has no section for #US5.02',
      }),
    );
  });

  it('opens the build gate once each row has its design and the acceptance is written and locked', () => {
    write(story, 'docs/architecture/reviews/US5.md', REVIEW);
    write(story, 'test/acceptance/us5.acceptance.spec.ts', SCENARIOS);

    expect(cli(story, 'story', '--gate', 'build').stdout).toContain('[ ] acceptance written and locked');
    expect(cli(story, 'acceptance', 'US5', '--lock').code).toBe(0);

    const built = cli(story, 'story', '--gate', 'build');

    expect(built.code).toBe(0);
    expect(built.stdout).toContain('gate build: met');
    expect(built.stdout).toMatch(/\[ \] rows done +0 of 2 done, next #US5\.01 Order/);
    expect(cli(story, 'story', '--gate', 'close').code).toBe(1);
  });

  it('closes once the rows are done, no scenario is pending and the report is written', () => {
    write(story, 'docs/architecture/slices.md', SLICES.replaceAll('| todo |', '| done |'));

    write(
      story,
      'test/acceptance/us5.acceptance.spec.ts',
      SCENARIOS.replace('pending(async () => {', 'async () => {').replace('}));', '});'),
    );

    expect(cli(story, 'story').stdout).toMatch(
      /\[ \] rows done +2 of 2 done, \d+ markers? of its own left \(`npx ddd-ts-kit story-check US5`\)/,
    );

    settleMarkers(story, 'US5');

    expect(cli(story, 'story').stdout).toContain('Next: Write `## Report` in docs/architecture/stories/US5.md');

    write(
      story,
      'docs/architecture/stories/US5.md',
      `${SPECIFICATION}\n## Report\n\n- D1 (provisional): the number is a sequence.\n`,
    );

    const closed = cli(story, 'story', '--gate', 'close');

    expect(closed.code).toBe(0);
    expect(closed.stdout).toContain('Next: nothing, the story is ready for its pull request.');
  });

  it('holds the close gate until `## Origin` says where the story comes from and what built it', () => {
    const report = '\n## Report\n\n- D1 (provisional): the number is a sequence.\n';

    write(story, 'docs/architecture/stories/US5.md', `${SPECIFICATION.replace(/^- From:.*\n/m, '')}${report}`);

    const unsourced = cli(story, 'story', '--gate', 'close');

    expect(unsourced.code).toBe(1);
    expect(unsourced.stdout).toMatch(/\[ \] origin recorded +`## Origin` has no `From:` line/);
    expect(unsourced.stdout).toContain('Next: Write `## Origin` in docs/architecture/stories/US5.md');

    write(
      story,
      'docs/architecture/stories/US5.md',
      `${SPECIFICATION.replace(/## Origin[^]*?\n(?=## )/, '')}${report}`,
    );

    expect(cli(story, 'story', '--json').json()).toMatchObject({
      phases: expect.arrayContaining([
        expect.objectContaining({ id: 'origin', met: false, detail: 'no `## Origin` in the specification' }),
      ]),
    });

    write(story, 'docs/architecture/stories/US5.md', `${SPECIFICATION}${report}`);

    expect(cli(story, 'story', '--gate', 'close').code).toBe(0);
  });

  it('asks which story outside the worktree of one, and refuses an unknown gate', () => {
    expect(cli(root, 'story').stderr).toContain('Which story? This is not the worktree of a story.');
    expect(cli(root, 'story', 'US5', '--gate', 'merge').stderr).toContain('Unknown gate "merge".');
  });
});
