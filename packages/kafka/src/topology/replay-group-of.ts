/** The group whose committed offsets say how far the dead-letter topics were replayed. */
export function replayGroupOf(consumer: string): string {
  return `${consumer}.replay`;
}
