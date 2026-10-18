import { describe, expect, it } from 'vitest';
import { BASELINE } from '../src/init/manifest/baseline.js';
import { exists, read, REPO_ROOT } from './helpers.js';
import { initProject } from './support/init-project.js';

const EXAMPLE = `${REPO_ROOT}/examples/scheduling`;

const STACKS: readonly (readonly [string, readonly string[]])[] = [
  ['the default stack', ['--ci', 'both']],
  ['jest', ['--ci', 'both', '--tests', 'jest', '--validation', 'none', '--di', 'manual', '--orm', 'custom']],
  ['no HTTP boundary', ['--ci', 'both', '--http', 'none']],
  ['legacy decorators, on knex', ['--ci', 'both', '--validation', 'class-validator', '--orm', 'knex']],
  ['nest, without a database', ['--ci', 'both', '--http', 'nest', '--di', 'nest', '--validation', 'standard-schema']],
  [
    'every opt-in job of the pipeline',
    [
      '--ci',
      'both',
      '--ci-extras',
      'codeql,dependency-review,gitlab-sast,gitlab-secret-detection,gitlab-dependency-scanning',
    ],
  ],
];

describe('the quality baseline', () => {
  it.each(STACKS)(
    'runs every gate in verify, in the GitHub pipeline and in the GitLab pipeline (%s)',
    (name, flags) => {
      const root = initProject(...flags);

      if (name !== 'no HTTP boundary') {
        expectBaseline(root);

        return;
      }

      // Nothing to drive end to end: the pipeline keeps the job, which says so, and verify has no script to call.
      expect(scriptsOf(root)['ci:test:e2e']).toContain('echo');
      expect(scriptsOf(root)['verify']).not.toContain('test:e2e');
    },
  );

  it('without an HTTP boundary every gate but the end-to-end one is in the three places', () => {
    const root = initProject('--ci', 'both', '--http', 'none');
    const verify = scriptsOf(root)['verify'] ?? '';
    const github = runBy(read(root, '.github/workflows/ci.yml'));
    const gitlab = runBy(read(root, '.gitlab-ci.yml'));

    for (const { gate, verify: script, pipeline } of BASELINE.filter((held) => held.verify !== 'test:e2e')) {
      expect(verify, gate).toMatch(new RegExp(`(npm|pnpm) run ${script}( |$)`));
      expect(github, gate).toEqual(expect.arrayContaining([...pipeline]));
      expect(gitlab, gate).toEqual(expect.arrayContaining([...pipeline]));
    }
  });

  it.each(STACKS)(
    'measures coverage in the test gate of verify and in the unit run of the pipeline (%s)',
    (_name, flags) => {
      const scripts = scriptsOf(initProject(...flags));

      expect(scripts['test:coverage']).toContain('--coverage');
      expect(scripts['ci:test:unit']).toContain('--coverage');
      expect(scripts['test']).not.toContain('--coverage');
    },
  );

  it('holds the same baseline in the example application, whose pipeline files are the generated ones', () => {
    expect(exists(EXAMPLE, 'package.json')).toBe(true);
    expectBaseline(EXAMPLE);
  });

  it('keeps the hooks to the fast subset: staged files before a commit and no coverage, types and unit specs before a push', () => {
    const hooks = read(initProject(), 'lefthook.yml');
    const [beforeCommit = '', beforePush = ''] = hooks.split('pre-push:');

    expect(beforeCommit).toContain('eslint --no-warn-ignored {staged_files}');
    expect(beforeCommit).toContain('biome format --no-errors-on-unmatched {staged_files}');
    expect(beforeCommit).toContain('ddd-ts-kit check {staged_files}');
    expect(beforeCommit).not.toMatch(/coverage|vitest|jest|(npm|pnpm) run/);
    expect(beforePush).toMatch(/(npm|pnpm) run ci:typecheck/);
    expect(beforePush).toMatch(/(npm|pnpm) run ci:test:unit/);
  });

  it.each(['npm', 'pnpm'])(
    'fails the lint of verify and of the pipeline on a warning as on an error (%s)',
    (manager) => {
      const scripts = scriptsOf(initProject('--ci', 'both', '--package-manager', manager));

      // A new project has no warning: the first one fails `lint`, `verify` and the pipeline, and is fixed or recorded.
      expect(scripts['lint']).toBe('eslint . --max-warnings 0');
      expect(scripts['ci:lint']).toBe('eslint . --max-warnings 0');
    },
  );

  it('writes no suppressions file: the warnings stay warnings, and a project records its existing errors itself', () => {
    expect(exists(initProject('--ci', 'both'), 'eslint-suppressions.json')).toBe(false);
  });

  it.each(['npm', 'pnpm'])('holds every gate in the three places whatever the package manager (%s)', (manager) => {
    expectBaseline(initProject('--ci', 'both', '--package-manager', manager));
  });
});

/**
 * What runs where. The default branch and the nightly run hold the whole baseline. A pull or
 * merge request narrows three runs to the contexts its change reaches through the context map
 * (unit specs, integration specs, lint) and nothing else: the gates that read the project as a
 * whole stay whole.
 */
describe('what a pull request runs, against the default branch', () => {
  const root = initProject('--ci', 'both', '--package-manager', 'npm');
  const github = read(root, '.github/workflows/ci.yml');
  const gitlab = read(root, '.gitlab-ci.yml');

  /** The gates no selection may narrow: the project is one type program, one import graph, one set of exports, one application. */
  const WHOLE = [
    ['typecheck', 'ci:typecheck'],
    ['lint', 'ci:format'],
    ['architecture', 'ci:arch:check'],
    ['architecture', 'ci:arch:graph'],
    ['deadcode', 'ci:deadcode'],
    ['e2e', 'ci:test:e2e'],
    ['build', 'ci:build'],
    ['build', 'ci:docs'],
  ] as const;

  /** The runs a selection narrows, with what carries the selection into each. */
  const NARROWED = [
    ['unit', 'ci:test:unit', 'DDD_TS_KIT_AFFECTED'],
    ['integration', 'ci:test:integration', 'DDD_TS_KIT_AFFECTED'],
    ['lint', 'ci:lint', 'LINT'],
  ] as const;

  it('computes the selection once, from the difference with the base on a pull request and from nothing anywhere else: the default branch and the schedule get everything', () => {
    expect(githubJob(github, 'install')).toContain(
      "BASE: ${{ github.event_name == 'pull_request' && 'HEAD^1' || '' }}",
    );

    expect(githubJob(github, 'install')).toContain('ddd-ts-kit affected --base "$BASE" --format github');
    expect(github).toMatch(/on:\n {2}push:\n {4}branches: \[main\]\n {2}pull_request:\n {2}schedule:\n/);

    expect(gitlabJob(gitlab, 'install')).toContain(
      'ddd-ts-kit affected --base "${CI_MERGE_REQUEST_DIFF_BASE_SHA:-}" --format env | tee affected.env',
    );

    expect(gitlab).toContain('- if: $CI_PIPELINE_SOURCE == "schedule"');
  });

  it.each(WHOLE)('never narrows %s (%s): no variable of the selection reaches it', (job, script) => {
    for (const [pipeline, text] of [
      ['GitHub', githubJob(github, job)],
      ['GitLab', gitlabJob(gitlab, job)],
    ] as const) {
      const line =
        text.split('\n').find((candidate) => new RegExp(`npm run (--silent )?${script}\\b`).test(candidate)) ?? '';

      expect(line, `${pipeline}: ${job} runs ${script}`).not.toBe('');
      expect(line, pipeline).not.toMatch(/AFFECTED|PARTIAL|LINT/);
    }

    if (job !== 'lint' && job !== 'e2e') {
      expect(githubJob(github, job)).not.toMatch(/outputs\.(contexts|args|lint)|outputs\.scope/);
      expect(gitlabJob(gitlab, job)).not.toContain('AFFECTED_');
    }
  });

  it.each(NARROWED)('narrows %s (%s) to the affected contexts, through %s', (job, script, carrier) => {
    expect(githubJob(github, job)).toContain(`npm run ${script} -- $`);
    expect(githubJob(github, job)).toContain(carrier);
    expect(gitlabJob(gitlab, job)).toMatch(new RegExp(`npm run ${script} -- .*\\$AFFECTED_(ARGS|LINT)`));
  });

  it('skips the specs, and only the specs, when nothing that runs changed: the end-to-end specs run for any other change', () => {
    for (const job of ['unit', 'integration', 'e2e']) {
      expect(githubJob(github, job), job).toContain("if: ${{ needs.install.outputs.scope != 'none' }}");
      expect(gitlabJob(gitlab, job), job).toContain('if [ "$AFFECTED_SCOPE" = "none" ]');
    }

    expect(github.match(/outputs\.scope != 'none'/g)).toHaveLength(7);
    expect(gitlab.match(/AFFECTED_SCOPE/g)).toHaveLength(3);
  });

  it('holds the coverage thresholds of every context a partial run names, and of all of them otherwise: the runner config reads the selection', () => {
    const config = read(root, 'vitest.config.ts');

    expect(config).toContain('const NOT_AFFECTED = unaffectedContexts().map((directory) => `${directory}**`);');
    expect(config).toContain('exclude: [INTEGRATION_SPECS, ...NOT_AFFECTED]');
    expect(config).toContain('...governedCoverage(mode),');

    expect(read(initProject('--tests', 'jest', '--orm', 'custom'), 'jest.config.js')).toContain(
      "testPathIgnorePatterns: ['/node_modules/', ...unaffectedContexts().map((directory) => `/${directory}`)],",
    );
  });

  it('needs every job in the gate, cancels a superseded run of a pull request only, and installs once', () => {
    const jobs = [...github.matchAll(/\n {2}([\w-]+):\n {4}name:/g)].map((match) => match[1] ?? '');
    const needed = /needs: \[([^\]]+)\]\n {4}runs-on: ubuntu-latest\n {4}timeout-minutes: 5/.exec(github)?.[1] ?? '';

    expect(needed.split(', ')).toEqual(jobs.filter((job) => job !== 'gate'));
    expect(github).toContain("cancel-in-progress: ${{ github.event_name == 'pull_request' }}");
    expect(github).not.toMatch(/npm ci|cache: npm/);
    expect(github.match(/uses: \.\/\.github\/actions\/setup/g)).toHaveLength(jobs.length - 2);
    expect(gitlab.match(/npm ci/g)).toHaveLength(1);
  });
});

function scriptsOf(root: string): Record<string, string> {
  const { scripts } = JSON.parse(read(root, 'package.json')) as { scripts: Record<string, string> };

  return scripts;
}

/** The scripts a pipeline file runs, with or without the flags it passes them, whatever the package manager. */
function runBy(pipeline: string): string[] {
  return [...pipeline.matchAll(/(?:npm|pnpm) (?:--silent )?run (?:--silent )?([\w:-]+)/g)].map(
    (match) => match[1] ?? '',
  );
}

function expectBaseline(root: string): void {
  const scripts = scriptsOf(root);
  const verify = (scripts['verify'] ?? '').split(' && ');
  const github = runBy(read(root, '.github/workflows/ci.yml'));
  const gitlab = runBy(read(root, '.gitlab-ci.yml'));

  for (const { gate, verify: script, pipeline } of BASELINE) {
    expect(verify, `verify: ${gate}`).toContainEqual(expect.stringMatching(new RegExp(`^(npm|pnpm) run ${script}$`)));
    expect(scripts[script], `script of ${gate}`).toEqual(expect.any(String));
    expect(github, `GitHub: ${gate}`).toEqual(expect.arrayContaining([...pipeline]));
    expect(gitlab, `GitLab: ${gate}`).toEqual(expect.arrayContaining([...pipeline]));
    expect(Object.keys(scripts), `pipeline scripts of ${gate}`).toEqual(expect.arrayContaining([...pipeline]));
  }
}

/** One job of a GitHub workflow, from its key to the next job. */
function githubJob(workflow: string, job: string): string {
  return new RegExp(`\\n  ${job}:\\n[\\s\\S]*?(?=\\n  [\\w-]+:\\n|$)`).exec(workflow)?.[0] ?? '';
}

/** One job of a GitLab pipeline, from its key to the next top-level key. */
function gitlabJob(pipeline: string, job: string): string {
  return new RegExp(`\\n${job}:\\n[\\s\\S]*?(?=\\n[\\w.-]+:\\n|$)`).exec(pipeline)?.[0] ?? '';
}
