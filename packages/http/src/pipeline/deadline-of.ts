import type { ExecuteOptions } from './execute-options';

/** When the request must be answered by, from the moment it arrived: none when the options set no timeout. */
export function deadlineOf(options: ExecuteOptions): Date | undefined {
  if (options.requestTimeoutMs === undefined) {
    return undefined;
  }

  const arrivedAt = options.clock?.now() ?? new Date();

  return new Date(arrivedAt.getTime() + options.requestTimeoutMs);
}
