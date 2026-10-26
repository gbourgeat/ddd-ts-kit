import { read, write } from '../helpers';
import { packedKit } from './packed-kit';
import { runIn } from './run-in';

export type Manager = 'npm' | 'pnpm';

type Manifest = Record<string, Record<string, string> | undefined>;

/** The install that writes the lockfile, then the one a pipeline runs, which refuses a lockfile that does not match. */
const INSTALLS: Readonly<Record<Manager, readonly [install: readonly string[], frozen: readonly string[]]>> = {
  npm: [
    ['install', '--no-audit', '--no-fund'],
    ['ci', '--no-audit', '--no-fund'],
  ],
  pnpm: [['install'], ['install', '--frozen-lockfile']],
};

/**
 * Installs a generated project with its own package manager, the kit taken from its packed
 * tarballs since no registry serves it yet: nothing is linked to the workspace, so the layout
 * of node_modules is the one a team gets. The frozen install of a pipeline, which proves that
 * the lockfile it just wrote is accepted, runs only where asked (`package-managers.spec.ts`
 * proves it, for the default stack and a heavy one, on both managers). Answers what the last
 * install printed.
 */
export function installForReal(root: string, manager: Manager, { frozen = false } = {}): string {
  pointAtTarballs(root, manager);

  const [install, frozenInstall] = INSTALLS[manager];
  const env = { COREPACK_ENABLE_DOWNLOAD_PROMPT: '0' };
  const printed = runIn(root, { command: manager, args: install, env });

  return frozen ? runIn(root, { command: manager, args: frozenInstall, env }) : printed;
}

/** Each manager has its own way to replace a package wherever it is asked for, a dependency of the kit on the kit included. */
function pointAtTarballs(root: string, manager: Manager): void {
  const kit = packedKit();
  const manifest = JSON.parse(read(root, 'package.json')) as Manifest;

  if (manager === 'pnpm') {
    const overrides = Object.entries(kit).map(([name, tarball]) => `  '${name}': '${tarball}'`);
    const workspace = read(root, 'pnpm-workspace.yaml');

    // init writes an overrides block of its own, and YAML refuses a second one: the tarballs join it.
    write(
      root,
      'pnpm-workspace.yaml',
      /^overrides:$/m.test(workspace)
        ? workspace.replace(/^overrides:$/m, `overrides:\n${overrides.join('\n')}`)
        : `${workspace}overrides:\n${overrides.join('\n')}\n`,
    );

    return;
  }

  write(root, 'package.json', `${JSON.stringify(withNpmOverrides(manifest, kit), null, 2)}\n`);
}

/** npm refuses an override that contradicts a direct dependency: the direct ones name the tarball, the override follows them. */
function withNpmOverrides(manifest: Manifest, kit: Readonly<Record<string, string>>): Manifest {
  const direct = { ...manifest['dependencies'], ...manifest['devDependencies'] };

  const pointed = (wanted: Record<string, string> = {}): Record<string, string> =>
    Object.fromEntries(Object.entries(wanted).map(([name, range]) => [name, kit[name] ?? range]));

  return {
    ...manifest,
    dependencies: pointed(manifest['dependencies']),
    devDependencies: pointed(manifest['devDependencies']),
    overrides: Object.fromEntries(
      Object.entries(kit).map(([name, tarball]) => [name, name in direct ? `$${name}` : tarball]),
    ),
  };
}
