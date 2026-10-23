import { MODULE_LAYERS } from './module-layers.js';

/** Puts a path relative to its context, written without modules, back in its module. */
export function intoModule(module: string | undefined, file: string): string {
  const [layer = '', ...rest] = file.split('/');

  if (module === undefined || !MODULE_LAYERS.includes(layer)) {
    return file;
  }

  return [layer, module, ...rest].join('/');
}
