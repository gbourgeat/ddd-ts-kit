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

/** One message for the two inner layers, as the checker writes it. */
export const OUTER_ENTRY_MESSAGE =
  '{{importer}} imports "{{specifier}}", {{what}}: allowing "{{name}}" does not allow its entries for adapters, wiring and test doubles. Import it where it belongs: an adapter or the wiring in infrastructure/ or src/platform, a test double in a test.';

/** What the outer entry `specifier` holds, unless the allow-list names that entry itself. */
export function outerEntry(specifier: string, allowed: readonly string[]): string | undefined {
  const entry = Object.entries(OUTER_ENTRIES).find(([name]) => specifier === name || specifier.startsWith(`${name}/`));

  return entry === undefined || allowed.includes(entry[0]) ? undefined : entry[1];
}
