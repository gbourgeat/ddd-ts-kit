**On TypeORM, `db:migrate` builds first, and runs what `db:generate` just wrote.** The data source reads `dist/migrations`, and a migration is written after the build: the README ended on `No migrations are pending` with one table, `migrations`, and `npm run dev` then logged failures of the outbox relay. `db:migrate` is now `npm run build && typeorm migration:run -d ...`.

To move: add `npm run build && ` at the start of the `db:migrate` script of `package.json`.
