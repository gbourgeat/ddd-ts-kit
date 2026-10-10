import type { AuditEntryExtensions } from './audit-entry-extensions.js';
import type { AuditJson } from './audit-json.js';

/** The extensions as an entry carries them: each one optional, and `never` when it is not JSON. */
export type AuditEntryExtensionValues = {
  readonly [Key in keyof AuditEntryExtensions]?: AuditEntryExtensions[Key] extends AuditJson
    ? AuditEntryExtensions[Key]
    : never;
};
