/** The file of an archive does not read back as it was written: the entries stay in the trail, the next run writes the file again. */
export class AuditArchiveNotStoredError extends Error {
  readonly code = 'AUDIT_ARCHIVE_NOT_STORED';

  constructor(
    readonly chain: string,
    readonly fileKey: string,
  ) {
    super(
      `The archive of ${chain} does not read back from the file storage as it was written (${fileKey}): nothing was removed from the trail`,
    );

    this.name = 'AuditArchiveNotStoredError';
  }
}
