/** The canonical tree of docs/ARCHITECTURE.md section 2, as data shared by the checker and the generator. */

export interface Role {
  /** Directory relative to the context; `*` stands for one open use-case level. */
  readonly directory: string;
  /** Accepted file suffixes; empty when the role only requires kebab-case. */
  readonly suffixes: readonly string[];
  /** Counted by naming/one-concept-per-file when true. */
  readonly oneConcept?: boolean;
  /** Suffixes whose files need a spec (test/spec-required). */
  readonly specFor?: readonly string[];
}

const ROLES: readonly Role[] = [
  { directory: 'published-language', suffixes: [] },
  { directory: 'domain/aggregates', suffixes: ['.aggregate.ts'], oneConcept: true, specFor: ['.aggregate.ts'] },
  { directory: 'domain/entities', suffixes: ['.entity.ts'], oneConcept: true },
  { directory: 'domain/value-objects', suffixes: ['.vo.ts'], oneConcept: true, specFor: ['.vo.ts'] },
  { directory: 'domain/events', suffixes: ['.event.ts'], oneConcept: true },
  { directory: 'domain/errors', suffixes: ['.error.ts'] },
  { directory: 'domain/repositories', suffixes: ['.repository.ts'] },
  { directory: 'domain/services', suffixes: ['.service.ts'], specFor: ['.service.ts'] },
  { directory: 'application/commands/*', suffixes: ['.command.ts', '.handler.ts'], oneConcept: true, specFor: ['.handler.ts'] },
  { directory: 'application/queries/*', suffixes: ['.query.ts', '.handler.ts'], oneConcept: true, specFor: ['.handler.ts'] },
  { directory: 'application/ports', suffixes: ['.port.ts'] },
  { directory: 'application/event-handlers', suffixes: ['.event-handler.ts'], oneConcept: true, specFor: ['.event-handler.ts'] },
  { directory: 'application/integration/publishers', suffixes: ['.publisher.ts'] },
  { directory: 'application/integration/consumers', suffixes: ['.consumer.ts'], oneConcept: true, specFor: ['.consumer.ts'] },
  { directory: 'infrastructure/persistence', suffixes: ['.repository.ts', '.mapper.ts', '.reader.ts', '.schema.ts'] },
  { directory: 'infrastructure/external', suffixes: [] },
  { directory: 'infrastructure/anti-corruption', suffixes: [] },
  { directory: 'presentation/http', suffixes: ['.route.ts', '.controller.ts', '.dto.ts'] },
  { directory: 'presentation/cli', suffixes: [] },
  { directory: 'test/builders', suffixes: ['.builder.ts'] },
];

/** Everything below these is free: tests may mirror the production tree. */
export const OPEN_DIRECTORIES: readonly string[] = ['test/unit', 'test/integration', 'test/fakes', 'test/builders'];

/** The role of a directory given relative to its context, if it is a role directory. */
export function roleOf(directory: string): Role | undefined {
  return ROLES.find((role) => matches(role.directory, directory));
}

export function isCanonicalDirectory(directory: string): boolean {
  if (OPEN_DIRECTORIES.some((open) => directory === open || directory.startsWith(`${open}/`))) return true;
  if (directory === 'test') return true;
  return ROLES.some((role) => {
    const parts = role.directory.split('/');
    // Every ancestor of a role directory is canonical too (domain/, application/integration/...).
    return parts.some((_, index) => matches(parts.slice(0, index + 1).join('/'), directory));
  });
}

function matches(pattern: string, directory: string): boolean {
  const expected = pattern.split('/');
  const actual = directory.split('/');
  return expected.length === actual.length && expected.every((part, index) => part === '*' || part === actual[index]);
}
