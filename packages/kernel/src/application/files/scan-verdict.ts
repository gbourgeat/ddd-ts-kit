/** What a `FileScanner` concludes: accepted, or refused with a stable reason (`INFECTED`, `ENCRYPTED_ARCHIVE`). */
export type ScanVerdict = { readonly accepted: true } | { readonly accepted: false; readonly reason: string };
