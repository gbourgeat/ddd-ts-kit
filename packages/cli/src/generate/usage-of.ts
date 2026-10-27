import type { Kind } from './kind';

/** The option of the kinds that write the files the modules of the model of a context divide. */
export const MODULE_OPTION = '[--module <module>]';

/** What follows `ddd-ts-kit generate` for a kind, as the help prints it: `--module` on the kinds that take it. */
export function usageOf(kind: Kind): string {
  return kind.writesInModules ? `${kind.usage} ${MODULE_OPTION}` : kind.usage;
}
