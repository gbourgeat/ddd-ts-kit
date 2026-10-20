/**
 * The role folder a role file of a context belongs to, both relative to the context: the folder
 * at `<layer>/<folder>/`, so that a file of a use case
 * (`application/commands/issue-invoice/issue-invoice.handler.ts`) or of a route
 * (`presentation/http/invoices/issue-invoice/issue-invoice.controller.ts`) rolls up to
 * `application/commands` or `presentation/http`; a file sitting directly in its layer
 * (`infrastructure/tax-rates.gateway.ts`) belongs to the layer itself.
 */
export function declarationsFolderOf(file: string): string {
  const [layer = '', folder, ...rest] = file.split('/');

  return folder === undefined || rest.length === 0 ? layer : `${layer}/${folder}`;
}
