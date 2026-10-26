import type { Stack } from '../config';

/** What the install of a stack writes outside the project, and the hosts its install scripts download from. */
export interface StackSandbox {
  readonly writes: readonly string[];
  readonly hosts: readonly string[];
}

/**
 * The cache of each package manager, on Linux then on macOS: the sandbox skips a path the machine
 * does not have. npm and pnpm check what they take from it against the integrity of the lockfile.
 */
const CACHES: Readonly<Record<Stack['packageManager'], readonly string[]>> = {
  npm: ['~/.npm'],
  pnpm: ['~/.local/share/pnpm/store', '~/.cache/pnpm', '~/Library/pnpm/store', '~/Library/Caches/pnpm'],
};

/**
 * What a choice of the stack adds. The install of Prisma downloads its engines into its cache from
 * its own host, and `prisma generate` touches them there. The Kafka client downloads its prebuilt
 * binary from the releases of its GitHub repository, which redirect to the host of release assets;
 * where no prebuilt binary fits, it builds from sources, which the sandbox does not allow (see
 * `firstInstallNote`), so the cache of node-gyp stays out.
 */
const BY_CHOICE: Readonly<Record<string, StackSandbox>> = {
  'orm:prisma': { writes: ['~/.cache/prisma'], hosts: ['binaries.prisma.sh'] },
  'broker:kafka': { writes: [], hosts: ['github.com', 'release-assets.githubusercontent.com'] },
};

/** What the sandbox of the regulated profile opens for the install of the stack `init` chose, and nothing more. */
export function stackSandbox(stack: Stack): StackSandbox {
  const choices = Object.entries(stack).flatMap(([key, value]) => BY_CHOICE[`${key}:${String(value)}`] ?? []);

  return {
    writes: [...CACHES[stack.packageManager], ...choices.flatMap((choice) => choice.writes)],
    hosts: [...new Set(choices.flatMap((choice) => choice.hosts))],
  };
}
