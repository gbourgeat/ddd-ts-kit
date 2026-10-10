import { toName } from '../naming/index.js';
import type { PolicyFact } from './context-description.js';
import type { ContextSources } from './context-sources.js';

const FOLDER = 'application/authorization';
const SUFFIX = '.policy.ts';

/** The policies of a context, one per `*.policy.ts` file, with the permission each one decides. */
export function readPolicies({ ws, directory }: ContextSources): PolicyFact[] {
  return ws
    .list(`${directory}/${FOLDER}`)
    .filter((file) => file.endsWith(SUFFIX))
    .map((file) => {
      const path = `${directory}/${FOLDER}/${file}`;

      return {
        name: toName(file.slice(0, -SUFFIX.length)).pascal,
        permission: /\w+Permissions\['([^']+)'\]/.exec(ws.read(path) ?? '')?.[1] ?? '',
        file: path,
      };
    });
}
