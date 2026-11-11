/** Everything below these is free: tests may mirror the production tree. */
export const OPEN_DIRECTORIES: readonly string[] = [
  'test/unit',
  'test/integration',
  'test/fakes',
  'test/builders',
  'test/worlds',
];

/**
 * The open directories `shared/` of a context divided into modules holds: the fakes, builders and
 * worlds that belong to no module. A spec is of the module of its subject, never of `shared/`.
 */
export const SHARED_OPEN_DIRECTORIES: readonly string[] = ['test/fakes', 'test/builders', 'test/worlds'];
