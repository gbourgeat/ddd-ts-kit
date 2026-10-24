/**
 * A checkpoint is kept as JSON text: a worker may clear it, and Prisma Client writes a SQL NULL
 * to a `Json` field only through the sentinel of the generated client, which this package does
 * not import.
 */
export function checkpointText(checkpoint: unknown): string | null {
  return checkpoint === undefined || checkpoint === null ? null : JSON.stringify(checkpoint);
}
