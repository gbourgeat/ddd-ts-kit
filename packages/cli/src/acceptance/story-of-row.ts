/** The story or milestone of a row, its id up to the last dot: `US5.03` belongs to `US5`. */
export function storyOfRow(id: string): string {
  const dot = id.lastIndexOf('.');

  return dot === -1 ? id : id.slice(0, dot);
}
