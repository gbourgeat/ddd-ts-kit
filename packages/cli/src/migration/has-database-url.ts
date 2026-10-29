/** Whether the environment names a database: with none, a migration is generated on the in-process one. */
export function hasDatabaseUrl(environment: NodeJS.ProcessEnv = process.env): boolean {
  return (environment['DATABASE_URL'] ?? '').trim() !== '';
}
