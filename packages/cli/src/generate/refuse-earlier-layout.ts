import { CliError } from '../cli-error';
import type { Config } from '../config';
import { declaredModules, earlierFolders } from '../model-modules';
import type { Workspace } from '../workspace';
import { filesUnder } from './files-under';

/**
 * A context divided into modules that still holds its tests and what belongs to no module at its
 * own level (`test/`, a layer folder with nothing but its schema or its route groups) is moved
 * before a generator writes in it: its modules now hold their tests, and `shared/` the rest.
 * Written in the layout of today, its new files would sit apart from the others.
 */
export function refuseEarlierLayout(ws: Workspace, config: Config, context: string | undefined): void {
  const modules = context === undefined ? [] : declaredModules(config, context);
  const files = modules.length === 0 ? [] : filesUnder(ws, `${config.contextsDir}/${context}`);
  const earlier = earlierFolders(files, modules);

  if (earlier.length > 0) {
    throw new CliError(
      `The context "${context}" is divided into modules and still holds ${earlier.map((folder) => `${folder}/`).join(', ')} at its own level: a module now holds its tests (<module>/test/), and shared/ what belongs to no module.`,
      `Run \`npx ddd-ts-kit context-layout ${context}\`, which moves each spec, fake and builder to its module, the schema, the route groups and the worlds of the context to shared/, and every import of them, commit, then run this again.`,
    );
  }
}
