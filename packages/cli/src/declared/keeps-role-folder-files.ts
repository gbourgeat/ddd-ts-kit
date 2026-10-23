import { barrelFile } from './barrel-file';
import { contextDeclarations, type DeclaredContext } from './context-declarations';
import { isDeclarationsFile } from './is-declarations-file';

/** What every layout writes for a context that declares no role file: such a context is current either way. */
const NOTHING_DECLARED = 'export {};\n';

/**
 * True while a context keeps its declarations in one file per role folder, as the generator wrote
 * them in 0.85 and 0.86 (`application/commands/commands.declarations.ts`): every generated file of
 * the context is exactly what that generator would write for the role files and constructors of
 * today, and none other is there. `read` gives the text of a file relative to the context. A
 * context whose role files all sit directly in their layer is written the same in both layouts:
 * it keeps none. This version accepts it with a warning (`earlierLayoutNotice`), so that
 * upgrading the kit fails no gate; a later minor version refuses it.
 */
export function keepsRoleFolderFiles(declared: DeclaredContext, read: (entry: string) => string | undefined): boolean {
  const { context, entries, modules } = declared;
  const { files } = contextDeclarations(declared, 'role-folder');

  if (files.get(barrelFile(context)) === NOTHING_DECLARED || sameFiles(files, contextDeclarations(declared).files)) {
    return false;
  }

  return (
    entries.every((entry) => !isDeclarationsFile(context, entry, modules) || files.has(entry)) &&
    [...files].every(([entry, expected]) => read(entry)?.replaceAll('\r\n', '\n') === expected)
  );
}

function sameFiles(left: ReadonlyMap<string, string>, right: ReadonlyMap<string, string>): boolean {
  return left.size === right.size && [...left].every(([file, content]) => right.get(file) === content);
}
