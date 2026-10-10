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
];

function scriptsOf(root: string): Record<string, string> {
  const { scripts } = JSON.parse(read(root, 'package.json')) as { scripts: Record<string, string> };

  return scripts;
}

/** The scripts a pipeline file runs, with or without the flags it passes them. */
function runBy(pipeline: string): string[] {
  return [...pipeline.matchAll(/npm run (?:--silent )?([\w:-]+)/g)].map((match) => match[1] ?? '');
}

function expectBaseline(root: string): void {
  const scripts = scriptsOf(root);
  const verify = (scripts['verify'] ?? '').split(' && ');
  const github = runBy(read(root, '.github/workflows/ci.yml'));
  const gitlab = runBy(read(root, '.gitlab-ci.yml'));

  for (const { gate, verify: script, pipeline } of BASELINE) {
    expect(verify, `verify: ${gate}`).toContain(`npm run ${script}`);
    expect(scripts[script], `script of ${gate}`).toEqual(expect.any(String));
    expect(github, `GitHub: ${gate}`).toEqual(expect.arrayContaining([...pipeline]));
    expect(gitlab, `GitLab: ${gate}`).toEqual(expect.arrayContaining([...pipeline]));
    expect(Object.keys(scripts), `pipeline scripts of ${gate}`).toEqual(expect.arrayContaining([...pipeline]));
  }
}

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
      expect(verify, gate).toContain(`npm run ${script}`);
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
    expect(beforeCommit).not.toMatch(/coverage|vitest|jest|npm run/);
    expect(beforePush).toContain('npm run ci:typecheck');
    expect(beforePush).toContain('npm run ci:test:unit');
  });
});
