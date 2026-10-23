import { MODULE_LAYERS, MODULE_TEST_FOLDERS } from './module-layers';

/**
 * Puts a path relative to its context, written without modules, back in its module: a file of a
 * layer under the folder of the module (`<module>/domain/...`), a spec under the module folder of
 * its test folder (`test/unit/<module>/...`). Any other path stays at the level of the context.
 */
export function intoModule(module: string | undefined, file: string): string {
  const [first = '', second = '', ...rest] = file.split('/');

  if (module === undefined) {
    return file;
  }

  if (MODULE_LAYERS.includes(first)) {
    return `${module}/${file}`;
  }

  return first === 'test' && MODULE_TEST_FOLDERS.includes(second) ? ['test', second, module, ...rest].join('/') : file;
}
