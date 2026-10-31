import type { Flaw } from '../model/flaw';

/**
 * Entries of an allowed package of the kit that hold an adapter, the wiring of a container or
 * test doubles: an allow-list that names the package does not name them, domain/ and
 * application/ import one only when the allow-list names that entry itself.
 */
const OUTER_ENTRIES: Readonly<Record<string, string>> = {
  '@ddd-ts-kit/auth/jwt': 'an authentication adapter',
  '@ddd-ts-kit/auth/passport': 'an authentication adapter',
  '@ddd-ts-kit/auth/rebac': 'the relation-based authorizer and its tuple stores',
  '@ddd-ts-kit/auth/di': 'the wiring of authorization in a container',
  '@ddd-ts-kit/auth/testing': 'test doubles',
  '@ddd-ts-kit/kernel/testing': 'test doubles',
};

const FIX =
  'Import it where it belongs: an adapter or the wiring in infrastructure/ or src/platform, a test double in a test.';

/** A package imported by an inner layer: its name and the entry written in the import. */
interface ImportedPackage {
  readonly name: string;
  readonly specifier: string;
}

/**
 * What is wrong with `specifier`, an entry of the allowed package `name`, imported by
 * `importer`: nothing, unless it reaches an outer entry the allow-list does not name.
 */
export function outerEntry(
  importer: string,
  { name, specifier }: ImportedPackage,
  allowed: readonly string[],
): Flaw | undefined {
  const entry = Object.entries(OUTER_ENTRIES).find(
    ([outer]) => specifier === outer || specifier.startsWith(`${outer}/`),
  );

  if (entry === undefined || allowed.includes(entry[0])) {
    return undefined;
  }

  return {
    message: `${importer} imports "${specifier}", ${entry[1]}: allowing "${name}" does not allow its entries for adapters, wiring and test doubles.`,
    fix: FIX,
  };
}
