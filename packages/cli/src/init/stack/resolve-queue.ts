import { QUEUE_STORES } from '../../config';
import { CliError } from '../../cli-error';
import { choose } from './choose';
import type { StackOptions } from './stack-options';

/** The ORMs whose package ships a job store and a process store sharing the transaction of the command. */
const QUEUE_ORMS = ['knex', 'drizzle', 'prisma'];

interface Persistence {
  readonly orm: string;
  readonly di: string;
}

/**
 * The jobs table of the ORM package when the project has one that ships it and the kernel module
 * of `@ddd-ts-kit/di` binds it, the memory of the process otherwise. `redis` needs the server of
 * the cache. A store asked for is bound whatever the container: by the kernel module on tsyringe,
 * by `jobs/create-background-work.ts` where the platform is wired by hand.
 */
export function resolveQueue(options: StackOptions, { orm, di }: Persistence): string {
  const queue =
    choose(QUEUE_STORES, options.queue, 'queue') ??
    (QUEUE_ORMS.includes(orm) && di === 'tsyringe' ? 'database' : 'memory');

  if (queue === 'database' && !QUEUE_ORMS.includes(orm)) {
    throw new CliError(
      `--queue database cannot be combined with --orm ${orm}.`,
      'The jobs table ships with @ddd-ts-kit/knex, @ddd-ts-kit/drizzle and @ddd-ts-kit/prisma; with another ORM pick --queue redis (with --cache redis) or --queue memory, or write a JobStore held by jobStoreContract.',
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
