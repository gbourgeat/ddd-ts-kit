/**
 * What a project adds to every entry, by declaration merging:
 *
 *     declare module '@ddd-ts-kit/kernel' {
 *       interface AuditEntryExtensions { readonly region: 'eu' | 'us' }
 *     }
 */
export interface AuditEntryExtensions {}
