import type { Config } from '../config';
import { declaredModules, moduleSplit } from '../model-modules';

/**
 * The folder of the unit specs a file of a context is tested in, from the project root: for a file
 * of a module of the model, the first of `<module>/test/unit` and `test/unit/<module>` that `holds`
 * says holds its spec; otherwise `test/unit` of the context, where a spec is written when none is
 * found.
 */
export function unitFolderOf(config: Config, file: string, holds: (folder: string) => boolean): string {
  const [context = '', ...rest] = file.slice(config.contextsDir.length + 1).split('/');
  const directory = `${config.contextsDir}/${context}`;
  const { module } = moduleSplit(rest.join('/'), declaredModules(config, context));
  const ofModule = module === undefined ? [] : [`${directory}/${module}/test/unit`, `${directory}/test/unit/${module}`];

  return ofModule.find(holds) ?? `${directory}/test/unit`;
}
