import { moduleSplit } from '../model-modules';
import { barrelFile } from './barrel-file';
import { contextDeclarations, type DeclaredContext } from './context-declarations';
import type { EarlierLayout } from './earlier-layout-notice';
import { isDeclarationsFile } from './is-declarations-file';
import { sameFiles } from './same-files';

const EXPORT = /^export \* from '([^']+)';$/;

/**
 * The earlier layout a context is laid out in, current or not: what `docs --check` and
 * `generate --local-only` keep it in, so that a role file written there is declared as that
 * version would declare it and nothing else moves. The single file of 0.84 when
 * `<context>.declarations.ts` is the only declarations file and exports role files itself; the
 * files of the role folders of 0.85 and 0.86 when one of them is there and no declarations file
 * of a layer that grouping would not write. `read` gives the text of a file relative to the
 * context. A context half moved, or written the same in both layouts, keeps none.
 */
export function earlierShapeOf(
  declared: DeclaredContext,
  read: (entry: string) => string | undefined,
): EarlierLayout | undefined {
  const { context, entries, modules } = declared;
  const generated = entries.filter((entry) => isDeclarationsFile(context, entry, modules));

  if (generated.length === 1 && generated[0] === barrelFile(context)) {
    return exportsRoleFiles(read(barrelFile(context)) ?? '') ? 'single-file' : undefined;
  }

  const byRoleFolder = contextDeclarations(declared, 'role-folder').files;
  const byLayer = contextDeclarations(declared).files;
  const inRoleFolder = (entry: string): boolean => moduleSplit(entry, modules).path.split('/').length === 3;

  const laidOut =
    generated.some(inRoleFolder) && generated.every((entry) => byRoleFolder.has(entry) || !byLayer.has(entry));

  return laidOut && !sameFiles(byRoleFolder, byLayer) ? 'role-folders' : undefined;
}

/** True when a summary exports a role file, not only the declarations of its layers. */
function exportsRoleFiles(summary: string): boolean {
  return summary.split('\n').some((line) => {
    const specifier = EXPORT.exec(line)?.[1];

    return specifier !== undefined && !/\.declarations(\.js)?$/.test(specifier);
  });
}
