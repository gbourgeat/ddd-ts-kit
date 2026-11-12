import { isDeclarationsFile } from '../declared';
import {
  isContextLevel,
  isRoleFolder,
  MODULE_LAYERS,
  MODULE_TEST_FOLDERS,
  moduleSplit,
  TEST_FOLDER,
} from '../model-modules';

/** The folders of the tests whose files follow their subject into a module, beside its specs. */
const SUPPORT_FOLDERS = ['fakes', 'builders'];

/** A context and the modules of its model. */
interface Held {
  readonly context: string;
  readonly modules: readonly string[];
}

/**
 * What the command does of a file of a context, relative to it, when it is named: `moves` for a
 * file of a role folder of a layer, a spec, a fake or a builder; `stays` for a file that is one
 * per context and for the generated declarations; `none` for a file no module holds.
 */
export function placeInModule(file: string, { context, modules }: Held): 'moves' | 'stays' | 'none' {
  const { path } = moduleSplit(file, modules);

  if (!hasPlaceInModule(path)) {
    return 'none';
  }

  return isContextLevel(context, path) || isDeclarationsFile(context, file, modules) ? 'stays' : 'moves';
}

/** True for a path, read without its module, that a module holds: a file of a role folder of a layer, a spec, a fake or a builder. */
function hasPlaceInModule(path: string): boolean {
  const [layer = '', folder = ''] = path.split('/');

  return layer === TEST_FOLDER
    ? MODULE_TEST_FOLDERS.includes(folder) || SUPPORT_FOLDERS.includes(folder)
    : MODULE_LAYERS.includes(layer) && isRoleFolder(layer, folder);
}
