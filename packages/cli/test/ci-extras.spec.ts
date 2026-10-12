import { describe, expect, it } from 'vitest';
import { cli, exists, read } from './helpers.js';
import { checkJsonOf, changeConfig } from './check-support.js';
import { initFailure } from './support/init-failure.js';
import { initProject } from './support/init-project.js';
import { readJson } from './support/read-json.js';

const EVERY_EXTRA = 'gitlab-sast,codeql,dependency-review,gitlab-secret-detection,gitlab-dependency-scanning';

/** What each opt-in job leaves in the files `init` writes. */
const MARKS = {
  codeql: 'github/codeql-action/analyze',
  dependencyReview: 'actions/dependency-review-action',
  sast: 'template: Jobs/SAST.gitlab-ci.yml',
  secretDetection: 'template: Jobs/Secret-Detection.gitlab-ci.yml',
  dependencyScanning: 'template: Jobs/Dependency-Scanning.v2.gitlab-ci.yml',
};

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

    expect(readJson(root, 'ddd-ts-kit.config.json')).toMatchObject({
      ci: {
        extras: ['codeql', 'dependency-review', 'gitlab-dependency-scanning', 'gitlab-sast', 'gitlab-secret-detection'],
      },
    });
  });

  it('adds one job alone, keeps it on init --force, and removes it with none', () => {
    const root = initProject('--ci', 'gitlab', '--ci-extras', 'gitlab-sast');

    expect(read(root, '.gitlab-ci.yml')).toContain(`include:\n  - ${MARKS.sast}\n\n`);
    expect(read(root, '.gitlab-ci.yml')).not.toContain(MARKS.secretDetection);

    expect(cli(root, 'init', '--force', '--logger', 'pino').code).toBe(0);
    expect(read(root, '.gitlab-ci.yml')).toContain(MARKS.sast);

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
