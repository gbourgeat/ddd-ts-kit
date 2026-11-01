import { AUDIT_MODES, CACHE_STACKS, ERROR_REPORTERS, LOGGERS, SEARCH_STACKS, STORAGE_STACKS } from '../../config';
import { choose } from './choose';
import type { StackOptions } from './stack-options';

/**
 * The cache stays in the process unless asked otherwise; files are kept in a local directory
 * unless an object store is asked for; no read model is kept in OpenSearch unless asked; the audit
 * trail is on as soon as there is a database to keep it in; unexpected failures are reported
 * nowhere unless asked; the logger writes JSON lines on the standard output unless pino or winston
 * is asked for. Error reporting hangs on the buses, the HTTP boundary, the jobs and the process,
 * which every stack has, and OpenSearch is reached over HTTP from any of them: no other choice
 * refuses either.
 */
export function resolveOperations(
  options: StackOptions,
  orm: string,
): Record<'cache' | 'storage' | 'search' | 'audit' | 'errors' | 'logger', string> {
  return {
    cache: choose(CACHE_STACKS, options.cache, 'cache') ?? 'none',
    // A new project keeps the content of its files in a directory while it is developed, in memory in its tests; a recorded one says what it chose, or none.
    storage: choose(STORAGE_STACKS, options.storage, 'storage') ?? 'local',
    search: choose(SEARCH_STACKS, options.search, 'search') ?? 'none',
    audit: choose(AUDIT_MODES, options.audit, 'audit') ?? (orm === 'none' ? 'off' : 'on'),
    errors: choose(ERROR_REPORTERS, options.errors, 'errors') ?? 'none',
    logger: choose(LOGGERS, options.logger, 'logger') ?? 'stdout',
  };
}
