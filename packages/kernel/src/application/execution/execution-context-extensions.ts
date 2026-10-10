/**
 * What a project adds to every execution context, by declaration merging:
 *
 *     declare module '@ddd-ts-kit/kernel' {
 *       interface ExecutionContextExtensions { readonly region: string }
 *     }
 */
export interface ExecutionContextExtensions {}
