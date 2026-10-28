**The identity preset is written on TypeORM.** `ddd-ts-kit context identity --preset identity` on a
project with `--orm typeorm` writes the five aggregates on TypeORM as on the other three ORM: an
`EntitySchema` per table, with the partial unique index that keeps one current membership per
account (`where "removed_at" IS NULL`), a mapper and a repository per aggregate, the search reader
of the members, the personal fields of accounts and invitations, and the contract spec of each
repository, which runs on the in-memory database of the tests and in the tenant under
`--tenancy shared-table`. Until now the preset refused `stack.orm: typeorm`.
