/** An event type, at one version when the caller asks for one. */
export type WantedEvent = { readonly type: string; readonly version?: number | undefined };
