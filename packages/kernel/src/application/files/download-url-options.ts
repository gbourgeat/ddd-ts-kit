export interface DownloadUrlOptions {
  /** Short: at most `MAX_SIGNED_URL_SECONDS`. A link leaks with the page, the log or the mail that holds it. */
  readonly expiresInSeconds: number;
  /** Offered to the browser as the name to save under (`Content-Disposition: attachment`). */
  readonly fileName?: string;
}
