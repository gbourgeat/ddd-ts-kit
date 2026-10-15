/** A failure after which drizzle-kit generate has written nothing and still exits 0, known by what it prints. */
export interface DrizzleSilentFailure {
  readonly printed: string;
  readonly message: string;
  readonly fix: string;
}

/** Measured on drizzle-kit 0.31.11. */
export const DRIZZLE_SILENT_FAILURES: readonly DrizzleSilentFailure[] = [
  {
    printed: 'Interactive prompts require a TTY',
    message:
      'drizzle-kit cannot tell whether a column or a table is new or renamed, and asks it on a terminal there is none of: no migration was written.',
    fix: 'Make the change unambiguous (add the new column or table in one migration, drop the old one in a later one), or write the statements yourself in a custom migration (`npm run db:generate -- <name> --custom`), or run `npm run db:generate <name>` in a terminal and answer. Never give it a pseudo-terminal (`script`, `unbuffer`): it then waits for an answer nobody gives.',
  },
  {
    printed: 'which is a collision',
    message:
      'Two snapshots of the migrations were generated from the same one, as two branches merged without regenerating: no migration was written.',
    fix: 'Keep the migrations of the main branch, delete the one of your branch (its .sql file, its snapshot under meta/ and its entry of meta/_journal.json), then run `npm run db:generate <name>` again on top of them; `npm run check:arch` names them (persistence/migration-history).',
  },
];
