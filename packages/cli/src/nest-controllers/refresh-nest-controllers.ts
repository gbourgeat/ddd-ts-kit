import type { Config } from '../config';
import { filesUnder } from '../generate/files-under';
import { toName } from '../naming';
import type { Workspace } from '../workspace';
import { controllersFile } from './controllers-file';
import { readNestControllers } from './read-nest-controllers';
import { renderControllersFile } from './render-controllers-file';

/**
 * Rewrites `<context>.controllers.ts` of every context of a project whose routes are Nest
 * controllers, from its controllers and the signatures of their methods. Called with the other
 * generated files: at the end of every `generate`, by `docs` and by the `dev` script.
 */
export function refreshNestControllers(ws: Workspace, config: Config): void {
  if (config.stack.routes !== 'nest') {
    return;
  }

  const files = {
    read: (file: string) => ws.read(file),
    under: (directory: string) => filesUnder(ws, directory).map((file) => `${directory}/${file}`),
  };

  for (const context of ws.directories(config.contextsDir).filter((name) => config.contexts[name] !== undefined)) {
    const file = `${config.contextsDir}/${context}/${controllersFile(context)}`;

    const content = renderControllersFile(
      context,
      `${toName(context).camel}Controllers`,
      readNestControllers(files, config, context),
    );

    if (ws.read(file) !== content) {
      if (ws.exists(file)) {
        ws.update(file, content);
      } else {
        ws.create(file, content);
      }
    }
  }
}
