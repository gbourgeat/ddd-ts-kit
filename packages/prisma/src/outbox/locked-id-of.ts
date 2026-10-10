export function lockedIdOf(row: unknown): string {
  if (typeof row === 'object' && row !== null && 'id' in row && typeof row.id === 'string') {
    return row.id;
  }

  throw new TypeError('The locking select of the outbox returned a row without an id');
}
