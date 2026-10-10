/**
 * What a project adds to every session, by declaration merging:
 *
 *     declare module '@ddd-ts-kit/kernel' {
 *       interface SessionExtensions { readonly plan: 'free' | 'team' }
 *     }
 */
export interface SessionExtensions {}
