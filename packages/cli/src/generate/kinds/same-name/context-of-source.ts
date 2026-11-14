import type { Config } from '../../../config';
import { workspaceSources } from './workspace-sources';
import type { Workspace } from '../../../workspace';
import { tablesFileOf } from './tables-file-of';

/** The context whose tables file a module specifier of the schema index resolves to, if any: by the file, never by what the specifier looks like. */
export function contextOfSource(ws: Workspace, config: Config, source: string): string | undefined {
  const resolved = workspaceSources(ws, config).resolve(`${config.platformDir}/database/schema.ts`, source);

  return resolved.kind === 'file'
    ? Object.keys(config.contexts).find((context) => tablesFileOf(ws, config, context) === resolved.path)
    : undefined;
}
