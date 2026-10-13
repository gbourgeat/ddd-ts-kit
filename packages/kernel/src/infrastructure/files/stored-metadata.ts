/** What the local storage writes beside a file, under `.metadata/`: what the file system does not know. */
export interface StoredMetadata {
  readonly mediaType: string;
  readonly checksum: string;
}
