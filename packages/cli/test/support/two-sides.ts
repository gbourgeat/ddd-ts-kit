import fs from 'node:fs';
import { cli, read, tempDir, write } from '../helpers';
import { expectOk } from './expect-ok';
import { git } from './git';
import { CONTEXTS } from './index-invariant';
import { onBranch } from './trunk-history';

/** What each side of a merge stores, each on its branch cut from the same base. */
interface Sides {
  readonly orm: string;
  /** More flags of `init`. */
  readonly flags?: readonly string[];
  /** What the two sides start from. */
  readonly base?: (root: string) => void;
  readonly trunk: (root: string) => void;
  readonly branch: (root: string) => void;
}

/** A project whose trunk and branch `build/work` each stored tables since their base, the branch checked out. */
export function twoSides({ orm, flags = [], base = () => undefined, trunk, branch }: Sides): string {
  const root = fs.realpathSync(tempDir('index-merge'));

  const commit = (message: string): void => {
    git(root, 'add', '--all');
    git(root, 'commit', '--quiet', '--message', message);
  };

  expectOk(cli(root, 'init', ...CONTEXTS, '--package-manager', 'npm', '--orm', orm, ...flags));

  const manifest: { scripts: Record<string, string> } = JSON.parse(read(root, 'package.json'));

  manifest.scripts['regenerate'] = 'node -e ""';
  write(root, 'package.json', `${JSON.stringify(manifest, null, 2)}\n`);
  git(root, 'init', '--quiet', '--initial-branch', 'main');
  base(root);
  commit('chore: base');
  git(root, 'branch', 'base');
  onBranch(root, 'build/work', 'base');
  branch(root);
  commit('feat: what the branch stores');
  onBranch(root, 'main');
  trunk(root);
  commit('feat: what landed on the trunk');
  onBranch(root, 'build/work');

  return root;
}
