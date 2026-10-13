/** What a queue holds, for a dashboard: alert on `dead` above zero and on `waiting` growing. */
export interface JobStoreStats {
  readonly waiting: number;
  readonly running: number;
  readonly dead: number;
}
