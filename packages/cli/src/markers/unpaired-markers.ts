import { REGION_MARKER } from './region-marker';

/** The regions of a text with an opening marker and no closing one, or the other way round. */
export function unpairedMarkers(lines: readonly string[]): string[] {
  const left = new Map<string, number>();

  for (const line of lines) {
    const [, closing, name] = REGION_MARKER.exec(line) ?? [];

    if (name !== undefined) {
      left.set(name, (left.get(name) ?? 0) + (closing === '' ? 1 : -1));
    }
  }

  return [...left].flatMap(([name, count]) => (count === 0 ? [] : [name]));
}
