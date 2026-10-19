import type { Config } from '../config/index.js';
import type { Workspace } from '../workspace/index.js';
import { flatRelocation } from './flat-relocation.js';
import type { Relocation } from './moved-specifier.js';
import { withMovedImports } from './with-moved-imports.js';

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
