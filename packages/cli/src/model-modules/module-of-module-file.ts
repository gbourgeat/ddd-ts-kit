import { moduleFileOf } from './module-file-of';

/** The module whose module file a path relative to its context is, among the modules of the model the config declares. */
export function moduleOfModuleFile(file: string, modules: readonly string[]): string | undefined {
  return modules.find((module) => file === moduleFileOf(module));
}
