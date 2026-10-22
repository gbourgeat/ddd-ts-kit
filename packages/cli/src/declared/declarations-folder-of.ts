import { intoModule, moduleSplit } from '../model-modules/index.js';

/**
 * The role folder a role file of a context belongs to, both relative to the context: the folder
 * at `<layer>/<folder>/`, so that a file of a use case
 * (`application/commands/issue-invoice/issue-invoice.handler.ts`) or of a route
 * (`presentation/http/invoices/issue-invoice/issue-invoice.controller.ts`) rolls up to
 * `application/commands` or `presentation/http`; a file sitting directly in its layer
 * (`infrastructure/tax-rates.gateway.ts`) belongs to the layer itself.
 */
export function declarationsFolderOf(inModule: string, modules: readonly string[]): string {
  const { module, path: file } = moduleSplit(inModule, modules);
  const [layer = '', folder, ...rest] = file.split('/');

  return intoModule(module, folder === undefined || rest.length === 0 ? layer : `${layer}/${folder}`);
}
