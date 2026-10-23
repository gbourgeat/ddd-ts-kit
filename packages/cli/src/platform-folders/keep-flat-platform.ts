import type { Config } from '../config';
import type { Workspace } from '../workspace';
import { flatRelocation } from './flat-relocation';
import type { Relocation } from './moved-specifier';
import { withMovedImports } from './with-moved-imports';

/**
 * In a project that keeps files of its platform flat, every module the command writes imports
 * them flat: the templates name them in their folders. Answers where each one is kept.
 */
export function keepFlatPlatform(ws: Workspace, config: Config): Relocation {
  const flat = flatRelocation(ws, config);

  if (flat.moved.size > 0) {
    ws.rewriteImports((file, text) => withMovedImports(text, file, flat));
  }

  return flat;
}
