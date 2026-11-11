**`ddd-ts-kit lint` takes the `--ignore-pattern` that `affected` writes, and three defects of the generators are fixed.**

- `affected --format github` and `--format gitlab` give the lint of a partial run as `--ignore-pattern <context>/`, one per context left out, and the generated pipeline hands that line to `npm run ci:lint`. `ddd-ts-kit lint` refused it (`Unknown option '--ignore-pattern'`), so the lint step of a partial run failed. `lint` now takes the option, as many times as given, and leaves those folders out on top of what the ESLint config of the project ignores.
- `generate projection` and the other kinds that name an integration event refused one whose type the formatter had folded, `export type InvoiceIssuedV2 =` on one line and `IntegrationEvent<...>` on the next. The declaration is read whatever its layout.
- The table of an aggregate whose last word is plural already keeps its name: `ReaderSettings` gives `reader_settings` where it gave `reader_settingses`. The words are `settings`, `preferences`, `news`, `series`, `species`, `data`, `metadata`, `analytics`, `statistics`, `logistics` and `economics`.
- `npm run db:generate <name>` on Drizzle refuses a name the journal already holds, and names the migration that carries it, before drizzle-kit runs: two migrations of one name read as one in a review.

To move: a table already generated as `..._settingses` keeps its name, nothing reads it again. Rename it by a migration if the name matters.
