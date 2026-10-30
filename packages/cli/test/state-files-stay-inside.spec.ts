import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { cli, tempDir, write } from './helpers';
import { committedProject } from './support/committed-project';
import { git } from './support/git';

let project: string;
let outside: string;

const SLICES = `# Slices

| # | Context | Kind | Slice | Start with | Depends on | Owner | Status |
|---|---|---|---|---|---|---|---|
| 1 | billing | skeleton | Invoice | \`generate aggregate billing Invoice\` | | conductor | done |
| 2 | billing | slice | Issue invoice | \`generate command billing IssueInvoice --aggregate Invoice --permission invoice.issue\` | 1 | billing | todo |
`;

beforeEach(() => {
  project = fs.realpathSync(committedProject('shop', '--context', 'billing:core'));
  outside = tempDir('state-files-outside');
  write(project, 'docs/architecture/slices.md', SLICES);
  git(project, 'add', '-A');
  git(project, 'commit', '--quiet', '--no-verify', '-m', 'slices');
});

/** A link committed in the project, as a repository that carries it would hold it. */
function commitLink(link: string, to: string): void {
  fs.mkdirSync(path.dirname(path.join(project, link)), { recursive: true });
  fs.symlinkSync(to, path.join(project, link));
  git(project, 'add', '-f', link);
  git(project, 'commit', '--quiet', '--no-verify', '-m', 'carries a link');
}

describe('the state and scope files a command writes', () => {
  it('story-scope writes the story file through no link that leads out of the project', () => {
    const victim = path.join(outside, 'victim');

    fs.writeFileSync(victim, 'do not touch');
    commitLink('.ddd-ts-kit/story.json', victim);

    const run = cli(project, 'story-scope', 'US1', '--no-install');

    expect(run.code).toBe(2);
    expect(run.stderr + run.stdout).toContain('written out of the project');
    expect(fs.readFileSync(victim, 'utf8')).toBe('do not touch');
  });

  it('worker-scope writes the worker file through no folder link that leads out of the project', () => {
    commitLink('.ddd-ts-kit', outside);

    const run = cli(project, 'worker-scope', 'billing', '--base', 'main', '--rows', '2', '--no-install');

    expect(run.code).toBe(2);
    expect(run.stderr + run.stdout).toContain('written out of the project');
    expect(fs.readdirSync(outside)).toEqual([]);
  });

  it('check --baseline write writes the baseline through no link that leads out of the project', () => {
    const made = path.join(outside, 'made-by-baseline.json');

    fs.symlinkSync(made, path.join(project, 'ddd-ts-kit-baseline.json'));

    const run = cli(project, 'check', '--baseline', 'write');

    expect(run.code).toBe(2);
    expect(fs.existsSync(made)).toBe(false);
  });

  it('a state file that is no link is still written', () => {
    const run = cli(project, 'check', '--baseline', 'write');

    expect(run.code).toBe(0);
    expect(fs.existsSync(path.join(project, 'ddd-ts-kit-baseline.json'))).toBe(true);
  });
});
