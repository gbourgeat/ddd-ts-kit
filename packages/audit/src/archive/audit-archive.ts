/** One range of a chain written to the file storage and removed from the trail. */
export interface AuditArchive {
  readonly chain: string;
  readonly fromSequence: number;
  readonly toSequence: number;
  /** The hash of the last entry archived: the anchor the chain goes on from. */
  readonly lastHash: string;
  readonly entries: number;
  /** Where the entries lie, one canonical JSON per line. */
  readonly fileKey: string;
  /** SHA-256 of the file, in lower-case hexadecimal. */
  readonly fileDigest: string;
  readonly archivedAt: Date;
}
