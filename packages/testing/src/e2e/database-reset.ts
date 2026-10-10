/**
 * How an end-to-end suite empties the database between tests. A contract only: the
 * implementation belongs to the project and its driver (see the README for PostgreSQL).
 */
export interface DatabaseReset {
  reset(): Promise<void>;
}
