/**
 * The module file of a module of the model, relative to its context: `<module>/<module>.module.ts`,
 * where the explicit style registers the handlers, consumers and reactions of that module, and
 * that the module file of the context composes.
 */
export function moduleFileOf(module: string): string {
  return `${module}/${module}.module.ts`;
}
