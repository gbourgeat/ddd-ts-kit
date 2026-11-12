import type { ModuleImport } from './module-imports';

/** The graph the imports between the modules of one context draw: the modules each module imports. */
export function importedModules(imports: readonly ModuleImport[]): (module: string) => string[] {
  return (module) => [...new Set(imports.filter((one) => one.from === module).map((one) => one.to))];
}
