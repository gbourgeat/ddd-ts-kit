import { toName } from '../naming';
import type { PolicyFact } from './context-description';
import type { ContextSources } from './context-sources';
import { roleFilesOf } from '../model-modules';

const FOLDER = 'application/authorization';
const SUFFIX = '.policy.ts';

/** The policies of a context, one per `*.policy.ts` file, with the permission each one decides. */
export function readPolicies(sources: ContextSources): PolicyFact[] {
  const { ws } = sources;

  return roleFilesOf(ws, sources, FOLDER)
    .filter(({ name }) => name.endsWith(SUFFIX))
    .map(({ name, path }) => ({
      name: toName(name.slice(0, -SUFFIX.length)).pascal,
      permission: /\w+Permissions\['([^']+)'\]/.exec(ws.read(path) ?? '')?.[1] ?? '',
      file: path,
    }));
}
