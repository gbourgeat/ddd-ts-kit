import { CliError } from '../cli-error';
import type { Config } from '../config';
import type { Workspace } from '../workspace';

const REPOSITORY_PORT = /\/domain\/(?:[^/]+\/)?repositories\/([^/]+)\.repository\.ts$/;

const E2E_SPEC = /^test\/e2e\/[^/]+\.e2e\.spec\.ts$/;

/**
 * `--local-only`: a plan that reaches outside the given context (its directory and the
 * end-to-end specs) is refused whole, before anything is written, naming the shared files.
 */
export function refuseSharedWrites(ws: Workspace, config: Config, context: string | undefined): void {
  const plan = ws.commit(true);

  const local = (file: string): boolean =>
    E2E_SPEC.test(file) || (context !== undefined && file.startsWith(`${config.contextsDir}/${context}/`));

  const shared = [...plan.created, ...plan.updated, ...plan.deleted].filter((file) => !local(file)).sort();

  if (shared.length === 0) {
    return;
  }

  throw new CliError(
    `--local-only: this command would write ${shared.length} shared file${shared.length === 1 ? '' : 's'}: ${shared.join(', ')}.`,
    `Nothing was written. ${repositoryAdvice(config, plan.created)}Have it run on the trunk without --local-only (the conductor of a parallel build does it), merge the trunk, then go on; a generated document listed alone means the trunk is stale: run \`ddd-ts-kit docs\` there first.`,
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
