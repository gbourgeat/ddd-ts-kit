import { CliError } from '../cli-error';
import type { Config } from '../config';
import type { Workspace } from '../workspace';
import { prismaSchemaOf } from '../prisma-schema';

const REPOSITORY_PORT = /\/domain\/(?:[^/]+\/)?repositories\/([^/]+)\.repository\.ts$/;

const E2E_SPEC = /^test\/e2e\/[^/]+\.e2e\.spec\.ts$/;

/**
 * `--local-only`: a plan that reaches outside the given context (its directory, its Prisma models
 * and the end-to-end specs) is refused whole, before anything is written, naming the shared files.
 */
export function refuseSharedWrites(
  ws: Workspace,
  config: Config,
  context: string | undefined,
  argv: readonly string[] = [],
): void {
  const plan = ws.commit(true);

  const local = (file: string): boolean =>
    E2E_SPEC.test(file) ||
    (context !== undefined &&
      (file.startsWith(`${config.contextsDir}/${context}/`) || file === prismaSchemaOf(context)));

  const shared = [...plan.created, ...plan.updated, ...plan.deleted].filter((file) => !local(file)).sort();

  if (shared.length === 0) {
    return;
  }

  throw new CliError(
    `--local-only: this command would write ${shared.length} shared file${shared.length === 1 ? '' : 's'}: ${shared.join(', ')}.`,
    `Nothing was written. ${repositoryAdvice(config, plan.created)}${trunkAdvice(argv)}Have it run on the trunk without --local-only (the conductor of a parallel build does it), merge the trunk, then go on; a generated document listed alone means the trunk is stale: run \`ddd-ts-kit docs\` there first.`,
  );
}

/** A command on an aggregate without a repository creates it: the trunk generates the repository first, as the row of the aggregate says. */
function repositoryAdvice(config: Config, created: readonly string[]): string {
  const prefix = `${config.contextsDir}/`;

  const commands = created.flatMap((file) => {
    const match = REPOSITORY_PORT.exec(file);

    if (match === null || !file.startsWith(prefix)) {
      return [];
    }

    const context = file.slice(prefix.length).split('/')[0] ?? '';
    const pascal = (match[1] ?? '').replace(/(?:^|-)(\w)/g, (_, letter: string) => letter.toUpperCase());

    return [`\`ddd-ts-kit generate repository ${context} ${pascal}\``];
  });

  if (commands.length === 0) {
    return '';
  }

  return `The aggregate has no repository yet: on the trunk, run ${commands.join(' and ')} first (it reads the aggregate, event-sourced or not), then run this command again. `;
}

/** Kinds whose shared files belong to the trunk (the contracts first): the refusal gives the conductor the command to run there. */
const CONDUCTOR_KINDS = new Set(['job', 'integration-event']);

/** A job or an integration event of a row is a step of the conductor on the trunk: the same command without `--local-only`, then the worker merges the trunk and fills the TODOs. */
function trunkAdvice(argv: readonly string[]): string {
  const [kind] = argv;

  if (kind === undefined || !CONDUCTOR_KINDS.has(kind)) {
    return '';
  }

  const command = withoutWorkerFlags(argv).map(quoted).join(' ');

  return `${kind === 'job' ? 'A' : 'An'} ${kind} of a row is a step of the conductor, before the row of the worker: on the trunk, run \`ddd-ts-kit generate ${command}\`, commit it there, merge the trunk into the worker's branch (\`ddd-ts-kit merge-trunk\`), then fill its TODOs. `;
}

/** The worker's own flags stay behind: `--local-only`, and `--cwd`, the directory of the worker's worktree, not of the trunk. */
function withoutWorkerFlags(argv: readonly string[]): string[] {
  return argv.flatMap((word, index) => {
    if (word === '--local-only' || word.startsWith('--cwd=') || word === '--cwd' || argv[index - 1] === '--cwd') {
      return [];
    }

    return [word];
  });
}

function quoted(word: string): string {
  return /^[\w@%+=:,./-]+$/.test(word) ? word : `"${word.replace(/(["\\$`])/g, '\\$1')}"`;
}
