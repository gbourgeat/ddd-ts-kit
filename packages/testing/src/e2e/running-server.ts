export interface RunningServer {
  /** Where the application listens, without a trailing slash: `http://127.0.0.1:49152`. */
  readonly url: string;
  close(): Promise<void>;
}
