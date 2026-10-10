/**
 * What a project adds to every error report, by declaration merging:
 *
 *     declare module '@ddd-ts-kit/kernel' {
 *       interface ErrorReportExtensions { readonly region: string }
 *     }
 */
export interface ErrorReportExtensions {}
