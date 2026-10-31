import { describe, expect, it } from 'vitest';
import { cli, write } from './helpers';
import { commitAll } from './support/commit-all';
import { git } from './support/git';
import { initProject } from './support/init-project';

const PLACEHOLDER = '<branch, tag or commit>';

function repository(): string {
  const root = initProject('--context', 'billing:core');

  write(root, 'reports/mutation/mutation.json', JSON.stringify({ files: {} }));
  commitAll(root);

  return root;
}

/** Each command that gives a ref as its example names the trunk only where it resolves. */
const COMMANDS: readonly { name: string; argv: readonly string[]; example: (trunk: string) => string }[] = [
  { name: 'cited', argv: ['cited', '--base', 'nothing-here'], example: (trunk) => `--base ${trunk}` },
  { name: 'digest', argv: ['digest'], example: (trunk) => `digest --base ${trunk}` },
  { name: 'verify-slice', argv: ['verify-slice', 'billing'], example: (trunk) => `--since ${trunk}` },
  { name: 'mutation', argv: ['mutation', '--changed', 'nothing-here'], example: (trunk) => `--changed ${trunk}` },
  { name: 'affected', argv: ['affected', '--base=-x'], example: (trunk) => `--base ${trunk}` },
];

describe.each(COMMANDS)('$name, on the example it gives for a ref', ({ argv, example }) => {
  it('gives a placeholder in a repository with no remote, where origin/main names nothing', () => {
    const root = repository();
    const refused = cli(root, ...argv);

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain(example(PLACEHOLDER));
    expect(refused.stderr).not.toContain('origin/main');
  });

  it('names origin/main once it resolves', () => {
    const root = repository();

    git(root, 'update-ref', 'refs/remotes/origin/main', 'HEAD');

    expect(cli(root, ...argv).stderr).toContain(example('origin/main'));
  });
});
