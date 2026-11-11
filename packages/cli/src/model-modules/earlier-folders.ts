import { isHeldByShared } from './is-held-by-shared';
import { SHARED_FOLDERS, TEST_FOLDER } from './module-layers';

/**
 * The folders at the level of a context divided into modules that are laid out as before its
 * modules held their tests and `shared/` what belongs to none, from the files of the context
 * given relative to it: its `test/` folder, and a layer folder that holds nothing but what
 * `shared/` holds now (its schema, its route groups). `ddd-ts-kit context-layout` moves them. A
 * layer that still holds a file of a module is a context in the middle of its move, which
 * `move-to-module` goes on with: it is none of them.
 */
export function earlierFolders(files: readonly string[], modules: readonly string[]): string[] {
  if (modules.length === 0) {
    return [];
  }

  return SHARED_FOLDERS.filter((folder) => {
    const held = files.filter((file) => file.startsWith(`${folder}/`));

    return held.length > 0 && (folder === TEST_FOLDER || held.every((file) => isHeldByShared(file)));
  });
}
