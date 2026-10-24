import { quoted } from '../read-model/quoted';

/**
 * The statement Prisma Client cannot express: the due jobs of a queue, earliest first, locked
 * `FOR UPDATE SKIP LOCKED`. Its parameters are the queue, the instant and the limit.
 */
export function dueJobsSelect(schema: string | undefined, table: string): string {
  const name = [schema, table]
    .filter((part) => part !== undefined)
    .map(quoted)
    .join('.');

  return [
    `select "id" from ${name} where "queue" = $1`,
    `and (("status" = 'waiting' and "run_at" <= $2) or ("status" = 'running' and "lease_until" <= $2))`,
    'order by "run_at", "sequence" limit $3 for update skip locked',
  ].join(' ');
}
