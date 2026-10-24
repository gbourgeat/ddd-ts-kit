**The erasure of a data subject from the tables of a context exists on the four ORMs, from the
`personalFields` declarations.** `KnexPersonalDataErasure`, `DrizzlePersonalDataErasure`,
`PrismaPersonalDataErasure` and `TypeOrmPersonalDataErasure` implement the `PersonalDataErasure`
port of the kernel over the unit of work of their package: the files the rows name are deleted
from the storage first, then the rows of the subject are deleted (`row`) or pseudonymised
(`pseudonymise`: a text column reads `[erased]`, a column of any other type nothing, a file column
nothing), and the rows reached are counted, none the second time. With the `tenant` option every
statement is confined to the tenant of the work and never widened by an elevation. A subject that
is not an opaque identifier is refused before any statement; a declaration that names file columns
without a file storage is refused when the adapter is built, and one that names a column or a
property the table does not have is refused before any file or row is touched. The types of the columns decide how a
column is pseudonymised (`pseudonymisedValueOf` of the kernel, the one rule the four follow), read
from the database on Knex and Prisma, from the table definition on Drizzle, from the entity on
TypeORM: a personal column that is not a text has to accept null, and a declaration that would
pseudonymise one that does not is refused before any file or row is touched
(`NotNullablePersonalColumnError`), so that an erasure never deletes the files of a person and
leaves their rows in clear. The four pass
`personalDataErasureContract` of `@ddd-ts-kit/testing`, on PGlite and PostgreSQL. Part 3 of
[privacy by design](../docs/proposals/privacy-by-design.md); the generator writes the declarations
in part 5, and the example adopts the adapter in part 11.
