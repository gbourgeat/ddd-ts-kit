import type { ErrorReportExtensions } from './error-report-extensions.js';

/** The extensions as a report carries them: each one optional. */
export type ErrorReportExtensionValues = {
  readonly [Key in keyof ErrorReportExtensions]?: ErrorReportExtensions[Key];
};
