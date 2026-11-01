/**
 * Two stores built under one name with another definition or other fields: they would share the
 * indices and aliases of that name. Each name starts with its context (`billing_invoices`).
 */
export class SearchNameTakenError extends Error {
  constructor(readonly readModel: string) {
    super(`the search read model "${readModel}" is already built with another definition or other fields`);
    this.name = 'SearchNameTakenError';
  }
}
