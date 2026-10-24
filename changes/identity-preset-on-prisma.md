**The identity preset is written on Prisma: `init --orm prisma --preset identity`.** The context
comes with its Prisma adapters (the repositories of the five aggregates, the search reader of the
members, their mappers over the generated client, the declarations of the personal fields), and
its models and enums laid out in `prisma/schema.prisma` in place of the ones the generators start:
the closed vocabularies (the role of a member, the status of an account and of an invitation) are
enums of the schema, the token of an invitation is unique, and one current membership per account
and organisation is a partial unique index, `where: { removedAt: null }`, for which the preset
turns on the `partialIndexes` preview feature of the client generator. The tables belong to no
tenant, as on Knex and Drizzle. The preset is still refused on TypeORM, the explicit style and
NestJS.

To move: nothing for an existing project. A project on Prisma that wants the context runs
`ddd-ts-kit generate context identity --preset identity`, then `npm run db:client` and
`npm run db:generate identity`.
