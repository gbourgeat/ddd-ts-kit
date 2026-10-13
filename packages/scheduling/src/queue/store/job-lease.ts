/**
 * Who may still report on a claimed job: the claim of that attempt. A worker whose lease expired
 * and whose job was claimed again holds an older attempt, and the store ignores it.
 */
export interface JobLease {
  readonly id: string;
  readonly attempt: number;
}
