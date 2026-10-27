import { CliError } from '../cli-error';
import type { Config } from '../config';
import { prismaSchemaOf } from '../stack/prisma-schema-of';
import type { Workspace } from '../workspace';

const E2E_SPEC = /^test\/e2e\/[^/]+\.e2e\.spec\.ts$/;

/**
 * `--local-only`: a plan that reaches outside the given context (its directory, its Prisma models
 * and the end-to-end specs) is refused whole, before anything is written, naming the shared files.
 */
export function refuseSharedWrites(ws: Workspace, config: Config, context: string | undefined): void {
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
    'Nothing was written. Have it run on the trunk without --local-only (the conductor of a parallel build does it), merge the trunk, then go on; a generated document listed alone means the trunk is stale: run `ddd-ts-kit docs` there first.',
  );
}
