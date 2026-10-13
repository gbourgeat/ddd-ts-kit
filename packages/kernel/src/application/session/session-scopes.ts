/**
 * The vocabulary of the scopes a project grants its clients, by declaration merging, so that a
 * guard names only scopes that exist:
 *
 *     declare module '@ddd-ts-kit/kernel' {
 *       interface SessionScopes { readonly 'invoices:read': true; readonly 'invoices:write': true }
 *     }
 */
export interface SessionScopes {}
