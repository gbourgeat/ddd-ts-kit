import { QUEUE_STORES } from '../../config';
import { CliError } from '../../cli-error';
import { choose } from './choose';
import type { StackOptions } from './stack-options';

/** The ORMs whose package ships a job store and a process store sharing the transaction of the command. */
const QUEUE_ORMS = ['knex', 'drizzle'];

interface Persistence {
  readonly orm: string;
  readonly di: string;
}

/**
 * The jobs table of the ORM package when the project has one that ships it, the memory of the
 * process otherwise. `redis` needs the server of the cache, and every store needs the kernel
 * module of `@ddd-ts-kit/di`, which binds it: refused before anything is written otherwise.
 */
export function resolveQueue(options: StackOptions, { orm, di }: Persistence): string {
  const queue =
    choose(QUEUE_STORES, options.queue, 'queue') ??
    (QUEUE_ORMS.includes(orm) && di === 'tsyringe' ? 'database' : 'memory');

  if (queue !== 'memory' && di !== 'tsyringe') {
    throw new CliError(
      `--queue ${queue} cannot be combined with --di ${di}.`,
      'The job store is bound by the kernel module of @ddd-ts-kit/di: use --di tsyringe, or keep --queue memory and bind a store where your platform builds the worker.',
    );
  }

  if (queue === 'database' && !QUEUE_ORMS.includes(orm)) {
    throw new CliError(
      `--queue database cannot be combined with --orm ${orm}.`,
      'The jobs table ships with @ddd-ts-kit/knex and @ddd-ts-kit/drizzle; with another ORM pick --queue redis (with --cache redis) or --queue memory, or write a JobStore held by jobStoreContract.',
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
