import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyResolutions } from '../src/merge/apply-resolutions';
import type { Resolution } from '../src/merge/resolution';
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

  it('a state file that cannot be written is reported with the file named, not left stale: a folder in its place', () => {
    write(project, '.ddd-ts-kit/story.json/held', 'x');
    git(project, 'add', '-f', '.ddd-ts-kit');
    git(project, 'commit', '--quiet', '--no-verify', '-m', 'a folder where the story file goes');

    const run = cli(project, 'story-scope', 'US1', '--no-install');

    expect(run.code).toBe(2);
    expect(run.stderr + run.stdout).toContain('story.json could not be written');
  });

  it('a state file that cannot be written is reported with the file named: a read-only one', () => {
    const baseline = path.join(project, 'ddd-ts-kit-baseline.json');

    fs.writeFileSync(baseline, '{}');
    fs.chmodSync(baseline, 0o444);

    const run = cli(project, 'check', '--baseline', 'write');

    expect(run.code).toBe(2);
    expect(run.stderr + run.stdout).toContain('ddd-ts-kit-baseline.json could not be written');
  });
});

describe('the resolutions of a merge', () => {
  it('are applied all or none: a path that leads out of the project refuses them before the first one is written', () => {
    const top = tempDir('resolutions-inside');
    const elsewhere = tempDir('resolutions-outside');

    const resolution = (file: string, content: string | null): Resolution => ({
      file,
      kind: 'registry',
      content,
      settled: false,
      how: 'test',
      blocks: [],
    });

    fs.writeFileSync(path.join(top, 'first.txt'), 'before');
    fs.writeFileSync(path.join(top, 'removed.txt'), 'kept');
    fs.symlinkSync(path.join(elsewhere, 'made.txt'), path.join(top, 'out.txt'));

    expect(() =>
      applyResolutions(top, [
        resolution('first.txt', 'after'),
        resolution('removed.txt', null),
        resolution('out.txt', 'x'),
      ]),
    ).toThrow('written out of the project');

    expect(fs.readFileSync(path.join(top, 'first.txt'), 'utf8')).toBe('before');
    expect(fs.existsSync(path.join(top, 'removed.txt'))).toBe(true);
    expect(fs.existsSync(path.join(elsewhere, 'made.txt'))).toBe(false);
  });
});
