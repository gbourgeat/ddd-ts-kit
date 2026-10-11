/** Names the bounded contexts a partial run covers, comma separated; unset or empty, the run covers every context. */
const AFFECTED = 'DDD_TS_KIT_AFFECTED';

/**
 * The contexts a pull request reaches, as `ddd-ts-kit affected` computed them from the context
 * map and the pipeline handed them over; undefined for a run of everything, which is what the
 * default branch gets.
 */
export function affectedContexts(): readonly string[] | undefined {
  const names = (process.env[AFFECTED] ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '');

  return names.length > 0 ? names : undefined;
}
