/** The client and the schema of the tests, derived from the Prisma schema at `schema`: the folder, or the one file of versions before 0.95. */
export function prismaClientScript(schema: string): string {
  return `prisma generate && prisma migrate diff --from-empty --to-schema ${schema} --script -o generated/schema.sql`;
}
