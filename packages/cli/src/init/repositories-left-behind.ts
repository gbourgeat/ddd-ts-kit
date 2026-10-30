import type { Config } from '../config';
import { filesUnder } from '../generate/files-under';
import { parseContextName, toName } from '../naming';
import type { Workspace } from '../workspace';

const REPOSITORY = /(?:^|\/)([a-z]+)-([a-z0-9-]+)\.repository\.ts$/;
/** An adapter of the personal data of a context stands beside its repositories and comes with them. */
const PERSONAL = /-personal-data-[a-z]+$/;

/**
 * The commands that write again the repositories of a context a change of ORM left behind: each
 * adapter of the ORM it leaves that has no twin on the ORM of the project, whose tables nothing
 * wires until it has one.
 */
export function repositoriesLeftBehind(
  ws: Workspace,
  config: Config,
  { name, earlierOrm }: { readonly name: string; readonly earlierOrm: string | undefined },
): string[] {
  const { orm } = config.stack;
  const context = parseContextName(name);

  if (earlierOrm === undefined || earlierOrm === orm) {
    return [];
  }

  const adapters = filesUnder(ws, `${config.contextsDir}/${context.kebab}`).flatMap((file) => {
    const [, prefix, aggregate = ''] = REPOSITORY.exec(file) ?? [];

    return prefix === undefined || PERSONAL.test(aggregate) ? [] : [{ prefix, aggregate }];
  });

  return adapters
    .filter(({ prefix }) => prefix === earlierOrm)
    .filter(({ aggregate }) => !adapters.some((twin) => twin.prefix === orm && twin.aggregate === aggregate))
    .map(({ aggregate }) => `generate repository ${context.kebab} ${toName(aggregate).pascal}`);
}
