import type { Config } from '../config/index.js';
import { toName } from '../naming/index.js';
import type { Workspace } from '../workspace/index.js';
import { roleFilesOf } from '../model-modules/index.js';

interface Tree {
  readonly ws: Workspace;
  readonly config: Config;
}

/** The names of the aggregates of a context, in PascalCase. */
export function aggregatesOf({ ws, config }: Tree, context: string): string[] {
  return roleFilesOf(ws, `${config.contextsDir}/${context}`, 'domain/aggregates')
    .map(({ name }) => name)
    .filter((name) => name.endsWith('.aggregate.ts'))
    .map((name) => toName(name.replace(/\.aggregate\.ts$/, '')).pascal);
}
