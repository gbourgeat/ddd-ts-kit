/** The registry of `@ddd-ts-kit/events`, restated structurally. Any `EventRegistry` fits. */
export interface AuditedEvents {
  all(): readonly { readonly type: string }[];
}
