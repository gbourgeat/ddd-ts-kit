import { aliasRoots, toAlias } from '../alias';
import type { Config } from '../config';
import type { Workspace } from '../workspace';

/** The names of the contexts whose files import the shared kernel, by its alias, in the order given. */
export function sharedKernelImporters(ws: Workspace, config: Config, contexts: readonly string[]): string[] {
  const prefix = toAlias(aliasRoots(config), config.sharedKernelDir, '');

  if (prefix === undefined) {
    return [];
  }

  const imported = new RegExp(`from\\s+['"]${escaped(prefix)}/|import\\(\\s*['"]${escaped(prefix)}/`);

  return contexts.filter((name) =>
    sourceFiles(ws, `${config.contextsDir}/${name}`).some((file) => imported.test(ws.read(file) ?? '')),
  );
}

/** Every TypeScript file under `directory`, on disk or planned by this command. */
function sourceFiles(ws: Workspace, directory: string): string[] {
  return [
    ...ws
      .list(directory)
      .filter((file) => file.endsWith('.ts'))
      .map((file) => `${directory}/${file}`),
    ...ws.directories(directory).flatMap((child) => sourceFiles(ws, `${directory}/${child}`)),
  ];
}

function escaped(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}
