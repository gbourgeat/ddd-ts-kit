import { describe, expect, it } from 'vitest';
import { cli, exists, read } from './helpers';
import { checkJsonOf, changeConfig } from './check-support';
import { initFailure } from './support/init-failure';
import { initProject } from './support/init-project';
import { readJson } from './support/read-json';
import { readYaml } from './support/read-yaml';
import { commitAll } from './support/commit-all';

const EVERY_EXTRA =
  'gitlab-sast,codeql,dependency-review,gitlab-secret-detection,gitlab-dependency-scanning,claude-review,claude-triage,intent-to-spec';

/** What each opt-in job leaves in the files `init` writes. */
const MARKS = {
  codeql: 'github/codeql-action/analyze',
  dependencyReview: 'actions/dependency-review-action',
  sast: 'template: Jobs/SAST.gitlab-ci.yml',
  secretDetection: 'template: Jobs/Secret-Detection.gitlab-ci.yml',
  dependencyScanning: 'template: Jobs/Dependency-Scanning.v2.gitlab-ci.yml',
  claudeInclude: 'local: .gitlab/claude-review.gitlab-ci.yml',
  claudeAction: 'anthropics/claude-code-action@',
};

const CLAUDE_GITHUB = ['.github/workflows/claude-review.yml', '.github/workflows/claude-triage.yml'];
const CLAUDE_GITLAB = '.gitlab/claude-review.gitlab-ci.yml';

describe('init --ci-extras: the jobs that need a paid plan are opt-in', () => {
  it('writes no paid or plan-dependent tool by default, on either platform, and records nothing', () => {
    const root = initProject('--ci', 'both');
    const github = read(root, '.github/workflows/ci.yml');
    const gitlab = read(root, '.gitlab-ci.yml');

    expect(exists(root, '.github/workflows/codeql.yml')).toBe(false);
    expect(github).not.toContain(MARKS.dependencyReview);
    expect(github).toContain('ghcr.io/gitleaks/gitleaks:');
    expect(github).toContain('npm run ci:audit');
    expect(gitlab).not.toMatch(/^include:/m);
    expect(gitlab).not.toMatch(/template: Jobs\/|AST_ENABLE_MR_PIPELINES/);
    expect(gitlab).toContain('gitleaks git . --redact --no-banner');
    expect(gitlab).toContain('npm run ci:audit');
    expect(readJson(root, 'ddd-ts-kit.config.json')).not.toHaveProperty('ci');
  });

  it('adds each job asked for, and records the list in the config', () => {
    const root = initProject('--ci', 'both', '--ci-extras', EVERY_EXTRA);
    const github = read(root, '.github/workflows/ci.yml');
    const gitlab = read(root, '.gitlab-ci.yml');

    expect(read(root, '.github/workflows/codeql.yml')).toContain(MARKS.codeql);
    expect(github).toContain(MARKS.dependencyReview);

    expect(gitlab).toContain(
      `include:\n  - ${MARKS.sast}\n  - ${MARKS.secretDetection}\n  - ${MARKS.dependencyScanning}\n`,
    );

    expect(gitlab).toContain("  AST_ENABLE_MR_PIPELINES: 'true'\n");
    expect(gitlab).toContain(MARKS.claudeInclude);

    expect(readJson(root, 'ddd-ts-kit.config.json')).toMatchObject({
      ci: {
        extras: [
          'claude-review',
          'claude-triage',
          'codeql',
          'dependency-review',
          'gitlab-dependency-scanning',
          'gitlab-sast',
          'gitlab-secret-detection',
          'intent-to-spec',
        ],
      },
    });
  });

  it('adds one job alone, keeps it on init --force, and removes it with none', () => {
    const root = initProject('--ci', 'gitlab', '--ci-extras', 'gitlab-sast');

    expect(read(root, '.gitlab-ci.yml')).toContain(`include:\n  - ${MARKS.sast}\n\n`);
    expect(read(root, '.gitlab-ci.yml')).not.toContain(MARKS.secretDetection);

    commitAll(root);
    expect(cli(root, 'init', '--force', '--logger', 'pino').code).toBe(0);
    expect(read(root, '.gitlab-ci.yml')).toContain(MARKS.sast);

    commitAll(root);
    expect(cli(root, 'init', '--force', '--ci-extras', 'none').code).toBe(0);
    expect(read(root, '.gitlab-ci.yml')).not.toContain(MARKS.sast);
    expect(readJson(root, 'ddd-ts-kit.config.json')).not.toHaveProperty('ci');
  });

  it('refuses an unknown job and a job of a platform the pipeline does not cover', () => {
    const unknown = initFailure('--ci-extras', 'codeql,snyk');
    const elsewhere = initFailure('--ci', 'gitlab', '--ci-extras', 'codeql');

    expect(unknown.code).toBe(2);
    expect(unknown.message).toBe('--ci-extras names "snyk", which is no extra job of the pipeline.');
    expect(unknown.fix).toContain('codeql, dependency-review, gitlab-sast');
    expect(elsewhere.message).toBe('--ci-extras codeql is a job of the GitHub pipeline, and --ci is gitlab.');
  });

  it('reports an unknown job written by hand in the config as config/valid', () => {
    const root = initProject('--ci', 'github');

    changeConfig(root, { ci: { extras: ['codeql', 'sonarcloud'] } });

    const violations = checkJsonOf(cli(root, 'check', '--rule', 'config/valid', '--json')).violations;

    expect(violations.map((violation) => violation.message)).toEqual([
      '"ci.extras" names "sonarcloud", which is no extra job of the pipeline.',
    ]);

    changeConfig(root, { ci: 'github' });

    expect(checkJsonOf(cli(root, 'check', '--rule', 'config/valid', '--json')).violations).toHaveLength(1);
  });
});

describe('init --ci-extras claude-review, claude-triage: Claude Code in the pipeline, on request', () => {
  it('writes the Claude review and triage jobs for both platforms, never required by the gate, as YAML every parser reads', () => {
    const root = initProject('--ci', 'both', '--ci-extras', 'claude-review,claude-triage');
    const [review = '', triage = ''] = CLAUDE_GITHUB.map((file) => read(root, file));
    const gitlab = read(root, CLAUDE_GITLAB);

    expect(review).toContain(MARKS.claudeAction);
    expect(review).toContain('on:\n  pull_request:');
    expect(review).toContain('gh pr comment');
    expect(review).not.toMatch(/gh pr review|gh pr merge/);
    expect(triage).toContain('workflow_run:');
    expect(triage).toContain("conclusion == 'failure'");
    expect(triage).toContain('--allowedTools "Read,Grep,Glob"');
    expect(read(root, '.github/workflows/ci.yml')).not.toMatch(/claude/i);
    expect(gitlab).toMatch(/^claude-review:$/m);
    expect(gitlab).toMatch(/^claude-triage:$/m);
    expect(gitlab).toContain('when: on_failure');
    expect(read(root, '.gitlab-ci.yml')).toContain(`include:\n  - ${MARKS.claudeInclude}\n`);

    const parsed = readYaml([review, triage, gitlab, read(root, '.gitlab-ci.yml')]).map(
      (back) => back.yaml12 as Record<string, unknown>,
    );

    expect(parsed.map((document) => Object.keys(document).slice(0, 5))).toEqual([
      ['name', 'on', 'concurrency', 'permissions', 'jobs'],
      ['name', 'on', 'permissions', 'jobs'],
      ['.claude', 'claude-review', 'claude-triage'],
      ['workflow', 'include', 'stages', 'variables', 'default'],
    ]);

    expect(parsed[2]).toMatchObject({
      '.claude': { allow_failure: true },
      'claude-review': { extends: '.claude', stage: 'test' },
      'claude-triage': { extends: '.claude', stage: 'gate', when: 'on_failure' },
    });
  });

  it('writes one Claude job alone, on the one platform asked for, since both pipelines hold them', () => {
    const github = initProject('--ci', 'github', '--ci-extras', 'claude-triage');
    const gitlab = initProject('--ci', 'gitlab', '--ci-extras', 'claude-review');

    expect(exists(github, '.github/workflows/claude-triage.yml')).toBe(true);
    expect(exists(github, '.github/workflows/claude-review.yml')).toBe(false);
    expect(exists(github, CLAUDE_GITLAB)).toBe(false);
    expect(exists(gitlab, CLAUDE_GITLAB)).toBe(true);
    expect(read(gitlab, CLAUDE_GITLAB)).toMatch(/^claude-review:$/m);
    expect(read(gitlab, CLAUDE_GITLAB)).not.toMatch(/^claude-triage:$/m);
    expect(read(gitlab, '.gitlab-ci.yml')).toContain(`include:\n  - ${MARKS.claudeInclude}\n\n`);
    expect(exists(gitlab, '.github/workflows/claude-review.yml')).toBe(false);
  });
});

describe('init --ci-extras intent-to-spec: the headless design pass of the story skill, on GitHub, on request', () => {
  it('writes the workflow on GitHub only, outside the gate, and refuses it on a GitLab pipeline', () => {
    const root = initProject('--ci', 'github', '--ci-extras', 'intent-to-spec');
    const workflow = read(root, '.github/workflows/intent-to-spec.yml');

    expect(workflow).toContain('types: [closed]');
    expect(workflow).toContain("- 'docs/architecture/intents/*.md'");
    expect(workflow).toContain('--headless');
    expect(workflow).toContain('ANTHROPIC_API_KEY');
    expect(read(root, '.github/workflows/ci.yml')).not.toMatch(/intent/i);
    expect(readJson(root, 'ddd-ts-kit.config.json')).toMatchObject({ ci: { extras: ['intent-to-spec'] } });

    const [parsed] = readYaml([workflow]).map((back) => back.yaml12 as Record<string, unknown>);

    expect(Object.keys(parsed ?? {}).slice(0, 5)).toEqual(['name', 'on', 'concurrency', 'permissions', 'jobs']);

    const elsewhere = initFailure('--ci', 'gitlab', '--ci-extras', 'intent-to-spec');

    expect(elsewhere.message).toBe('--ci-extras intent-to-spec is a job of the GitHub pipeline, and --ci is gitlab.');
  });
});
