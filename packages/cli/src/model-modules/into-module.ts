import { MODULE_LAYERS, TEST_FOLDER } from './module-layers';

/** The folders of the tests a module holds for itself: its specs, its fakes and its builders. */
const MODULE_TESTS: readonly string[] = ['unit', 'integration', 'fakes', 'builders'];

/**
 * Puts a path relative to its context, written without modules, in its module: a file of a layer
 * under the folder of the module (`<module>/domain/...`), a spec, a fake or a builder in its test
 * folder (`<module>/test/unit/...`). Any other path stays as it is written.
 */
export function intoModule(module: string | undefined, file: string): string {
  const [first = '', second = ''] = file.split('/');
  const held = MODULE_LAYERS.includes(first) || (first === TEST_FOLDER && MODULE_TESTS.includes(second));

  return module !== undefined && held ? `${module}/${file}` : file;
}
