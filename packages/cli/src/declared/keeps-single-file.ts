import { barrelFile } from './barrel-file.js';
import type { DeclaredContext } from './context-declarations.js';
import { isDeclarationsFile } from './is-declarations-file.js';
import { singleFileDeclarations } from './single-file-declarations.js';

/** What both layouts write for a context that declares no role file: such a context is current either way. */
const NOTHING_DECLARED = 'export {};\n';

/**
 * True while a context keeps its declarations in the single file the generator wrote up to 0.84:
 * no role folder holds a declarations file yet, and `<context>.declarations.ts` (`written`) is
 * exactly what that generator would write for the role files and constructors of today. This
 * version accepts it with a warning (`singleFileNotice`), so that upgrading the kit fails no gate;
 * a later minor version refuses it. A single file that is itself stale, or a context half moved,
 * is not this case.
 */
export function keepsSingleFile(declared: DeclaredContext, written: string | undefined): boolean {
  const { context, entries } = declared;
  const moving = entries.some((entry) => entry !== barrelFile(context) && isDeclarationsFile(context, entry));

  if (written === undefined || moving) {
    return false;
  }

  const single = singleFileDeclarations(declared);

  return single !== NOTHING_DECLARED && written.replaceAll('\r\n', '\n') === single;
}
