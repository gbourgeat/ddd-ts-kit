/**
 * Whether a file or a folder of the migrations folder is named as a migration, a number then a
 * name, as every tool writes them. A helper beside them (`helpers.js`, `index.ts`) is not one,
 * and takes no part in their order.
 */
export function hasMigrationName(name: string): boolean {
  return /^\d+[_-]/.test(name);
}
