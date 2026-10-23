import { moduleSplit } from '../model-modules';

/**
 * How the declarations of a context are grouped: one file per layer, as the generator writes them,
 * or one per role folder, as 0.85 and 0.86 wrote them (`keepsRoleFolderFiles` alone reads that one).
 */
export type DeclarationsGrouping = 'layer' | 'role-folder';

/**
 * The folder whose generated declarations hold a role file of a context, both relative to the
 * context: its layer, in the module of the model that holds it
 * (`application/commands/issue-invoice/issue-invoice.handler.ts` and
 * `presentation/http/invoices/issue-invoice/issue-invoice.controller.ts` go to `application` and
 * `presentation`). Grouped by role folder, it is the folder at `<layer>/<folder>/`, and a file
 * sitting directly in its layer (`infrastructure/tax-rates.gateway.ts`) goes to the layer itself.
 */
export function declarationsFolderOf(
  inModule: string,
  modules: readonly string[],
  grouping: DeclarationsGrouping = 'layer',
): string {
  const parts = moduleSplit(inModule, modules).path.split('/');
  const kept = grouping === 'role-folder' && parts.length > 2 ? 2 : 1;

  // The part of the path below the folder is the same in a module and outside one.
  return inModule
    .split('/')
    .slice(0, kept - parts.length)
    .join('/');
}
