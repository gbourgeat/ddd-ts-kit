/** One file of a listing: enough to decide what to purge, without a request per file. */
export interface ListedFile {
  readonly key: string;
  readonly size: number;
  readonly lastModified: Date;
}
