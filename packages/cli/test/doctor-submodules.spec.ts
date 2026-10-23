import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, tempDir, write } from './helpers';
import { git } from './support/git';
import { installKit } from './support/install-kit';

/** A project whose repository records a submodule at `vendor/rates`, cloned without it. */
function projectWithSubmodule(): { root: string; commit: string } {
  const library = path.join(tempDir('doctor-submodule-library'), 'rates');

  write(library, 'README.md', 'rates\n');
  git(library, 'init', '--quiet');
  git(library, 'add', '.');
  git(library, 'commit', '--quiet', '-m', 'rates');

  const commit = git(library, 'rev-parse', 'HEAD').trim();
  const root = path.join(tempDir('doctor-submodule'), 'shop');

  cli(root, 'init', '--context', 'billing:core', '--package-manager', 'npm');
  installKit(root);
  git(root, 'init', '--quiet');
  write(root, '.gitmodules', `[submodule "vendor/rates"]\n\tpath = vendor/rates\n\turl = ${library}\n`);
  git(root, 'update-index', '--add', '--cacheinfo', `160000,${commit},vendor/rates`);

  return { root, commit };
}

describe('doctor, on the submodules', () => {
  it('fails --strict on a submodule not initialised, and names the fix', () => {
    const { root, commit } = projectWithSubmodule();
    const result = cli(root, 'doctor', '--strict');

    expect(result.code).toBe(1);

    expect(result.stdout).toContain(
      `  submodule vendor/rates: not initialised (checked out at ${commit.slice(0, 12)})`,
    );

    expect(result.stdout).toContain('fix: `git submodule update --init --recursive`');
  });

  it('says nothing of the submodules once they are initialised', () => {
    const { root } = projectWithSubmodule();

    git(root, '-c', 'protocol.file.allow=always', 'submodule', 'update', '--init', '--quiet');

    expect(cli(root, 'doctor').stdout).toContain('This checkout runs it');
  });
});
