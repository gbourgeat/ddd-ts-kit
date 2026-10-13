/** What a storage knows of a file it holds, without reading the content. */
export interface FileMetadata {
  readonly key: string;
  readonly size: number;
  readonly mediaType: string;
  readonly lastModified: Date;
  /** `sha256:<hex>`, when the connector keeps it: the S3 connector does not. */
  readonly checksum?: string;
}
