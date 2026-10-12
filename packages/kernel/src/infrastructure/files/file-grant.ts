/** What a signed link allows: one action on one key, until `expiresAt` (seconds since the epoch). */
export interface FileGrant {
  readonly action: 'download' | 'upload';
  readonly key: string;
  readonly expiresAt: number;
  readonly fileName?: string;
  readonly mediaType?: string;
}
