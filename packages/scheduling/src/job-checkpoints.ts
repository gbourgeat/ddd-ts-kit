/**
 * Where a scheduler remembers the last occurrence it handled for each job, so that a restart
 * knows what passed while the process was down. Shared by the instances of an application: a
 * table, a key of a store.
 */
export abstract class JobCheckpoints {
  static readonly tokenKey = 'scheduling.JobCheckpoints';

  abstract read(job: string): Promise<Date | undefined>;

  abstract write(job: string, handled: Date): Promise<void>;
}
