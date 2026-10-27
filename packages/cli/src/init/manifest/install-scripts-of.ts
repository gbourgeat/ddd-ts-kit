import type { Stack } from '../../config';

/**
 * A dependency of the stack whose install script the project needs: npm 11 asks for each install
 * script to be reviewed (it runs an unreviewed one with a warning in 11.19, and says a later release
 * blocks it), and pnpm runs none it is not told to. Init allows these by name, doctor reports one
 * installed that the list does not allow.
 */
export interface InstallScript {
  readonly name: string;
  /** What its script does that the project needs. */
  readonly does: string;
  /** The dependency of the project that brings it, then each package down to it: where doctor reads its version. */
  readonly through: readonly string[];
  readonly applies: (stack: Stack) => boolean;
}

/**
 * Only the scripts the stack cannot do without. The others an install lists are left to the team:
 * the preinstall of `prisma` checks the version of Node; esbuild, @swc/core, unrs-resolver and
 * @parcel/watcher load the prebuilt binary of an optional dependency without theirs; lefthook's
 * installs the git hooks, which `hooks:install` does.
 */
const INSTALL_SCRIPTS: readonly InstallScript[] = [
  {
    name: '@prisma/engines',
    does: 'downloads the schema engine that `prisma migrate` and `db:client` run (the CLI fetches it at first use otherwise)',
    through: ['prisma', '@prisma/engines'],
    applies: (stack) => stack.orm === 'prisma',
  },
  {
    name: '@confluentinc/kafka-javascript',
    does: 'downloads the prebuilt native client, or builds it from sources: without it the client does not load',
    through: ['@confluentinc/kafka-javascript'],
    applies: (stack) => stack.broker === 'kafka',
  },
];

/** The install scripts the chosen stack needs, in the order of the registry. */
export function installScriptsOf(stack: Stack): readonly InstallScript[] {
  return INSTALL_SCRIPTS.filter((script) => script.applies(stack));
}
