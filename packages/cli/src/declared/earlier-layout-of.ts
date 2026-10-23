import { barrelFile } from './barrel-file';
import type { DeclaredContext } from './context-declarations';
import type { EarlierLayout } from './earlier-layout-notice';
import { keepsRoleFolderFiles } from './keeps-role-folder-files';
import { keepsSingleFile } from './keeps-single-file';

/**
 * The earlier layout a context keeps its declarations in, current for its tree of today, or
 * undefined when it keeps none: the single file of 0.84 (`keepsSingleFile`) or the files of its
 * role folders of 0.85 and 0.86 (`keepsRoleFolderFiles`). `read` gives the text of a file
 * relative to the context.
 */
export function earlierLayoutOf(
  declared: DeclaredContext,
  read: (entry: string) => string | undefined,
): EarlierLayout | undefined {
  if (keepsSingleFile(declared, read(barrelFile(declared.context)))) {
    return 'single-file';
  }

  return keepsRoleFolderFiles(declared, read) ? 'role-folders' : undefined;
}
