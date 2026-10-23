/**
 * The path of a source of a context from the contexts directory, without its extension, the way
 * an import of it is matched: `billing/domain/errors/invoice.error` or, in a module of the model,
 * `billing/invoices/domain/errors/invoice.error`.
 */
export function pathFromContexts(file: string, context: string): string {
  return file.slice(file.indexOf(`/${context}/`) + 1).replace(/\.ts$/, '');
}
