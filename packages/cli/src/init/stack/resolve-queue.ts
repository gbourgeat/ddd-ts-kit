import { QUEUE_ORMS, QUEUE_STORES } from '../../config';
import { CliError } from '../../cli-error';
import { choose } from './choose';
import type { StackOptions } from './stack-options';

/**
 * The jobs table of the ORM package when the ORM ships one, whatever the container: the kernel
 * module binds it on tsyringe, `jobs/create-background-work.ts` where the platform is wired by
 * hand or under Nest. The memory of the process otherwise. `redis` needs the server of the cache.
 */
export function resolveQueue(options: StackOptions, orm: string): string {
  const queue = choose(QUEUE_STORES, options.queue, 'queue') ?? (QUEUE_ORMS.includes(orm) ? 'database' : 'memory');

  if (queue === 'database' && !QUEUE_ORMS.includes(orm)) {
    throw new CliError(
      `--queue database cannot be combined with --orm ${orm}.`,
      'The jobs table ships with the package of each ORM: @ddd-ts-kit/knex, drizzle, prisma and typeorm; with a custom persistence or none pick --queue redis (with --cache redis) or --queue memory, or write a JobStore held by jobStoreContract.',
    );
  }

  if (queue === 'redis' && options.cache !== 'redis') {
    throw new CliError(
      '--queue redis needs --cache redis.',
      'The Redis job store uses the connection of the cache, Dragonfly in docker-compose and in CI: add --cache redis, or pick --queue database.',
    );
  }

  return queue;
}
