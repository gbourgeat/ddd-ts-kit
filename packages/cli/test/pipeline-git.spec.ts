import { describe, expect, it } from 'vitest';
import { read } from './helpers';
import { initProject } from './support/init-project';

describe('pipeline jobs that call git', () => {
  /** The top-level blocks of a GitLab file, by job name. */
  const jobsOf = (text: string): Map<string, string> =>
    new Map([...text.matchAll(/^([A-Za-z_][\w.-]*):\n((?:[ \t].*\n|\n)*)/gm)].map((m) => [m[1] ?? '', m[2] ?? '']));

  const callsGit = (job: string): boolean =>
    /^\s+- .*(?:^|[\s;&|(])git (?:fetch|diff|merge-base|log|rev-parse)/m.test(job);

  it('every GitLab job whose script calls git names an image with git', () => {
    const gitlab = read(initProject('--package-manager', 'npm', '--ci', 'gitlab'), '.gitlab-ci.yml');
    const callers = [...jobsOf(gitlab)].filter(([, job]) => callsGit(job));

    expect(callers.map(([name]) => name)).toContain('mutation_changed');

    for (const [name, job] of callers) {
      expect(job, name).toMatch(/^ {2}image: node:24-bookworm$/m);
    }
  });

  it('the mutation reading is allowed to fail on GitLab and may read the runs on GitHub', () => {
    const gitlab = read(initProject('--package-manager', 'npm', '--ci', 'gitlab'), '.gitlab-ci.yml');
    const github = read(initProject('--package-manager', 'npm'), '.github/workflows/ci.yml');

    expect(jobsOf(gitlab).get('mutation_changed')).toContain('allow_failure: true');

    expect(github).toMatch(
      /mutation-changed:\n(?: {4}.*\n)*? {4}permissions:\n {6}contents: read\n {6}actions: read\n/,
    );
  });
});
