export interface RedisJobStoreOptions {
  /** Prefix of the keys, typically the application. Default `jobs`. */
  readonly namespace?: string;
  /**
   * Told when a job staged by a committed unit of work could not be written (that job is lost),
   * or a cancellation or a revival staged the same way could not be applied. The composition
   * root hands it to the error reporter and the logger. Default: nothing is told.
   */
  readonly onLostJob?: (error: unknown, jobId: string) => void;
}
