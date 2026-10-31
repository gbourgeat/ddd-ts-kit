import { REGION_MARKER } from './region-marker';

/** A generated region of a text: its name and the lines of its two markers. */
export interface Region {
  readonly name: string;
  readonly open: number;
  readonly close: number;
}

/** The regions of a text, in their order, each closed after it opens. What a region holds is its own: one written inside another is not listed. */
export function regionsOf(lines: readonly string[]): Region[] {
  const opened = new Map<string, number>();
  const regions: Region[] = [];

  lines.forEach((line, at) => {
    const [, closing, name] = REGION_MARKER.exec(line) ?? [];
    const open = name === undefined ? undefined : opened.get(name);

    if (name !== undefined && closing === '') {
      opened.set(name, at);
    } else if (name !== undefined && open !== undefined) {
      regions.push({ name, open, close: at });
      opened.delete(name);
    }
  });

  const ordered = regions.toSorted((one, other) => one.open - other.open);

  return ordered.filter((region) => !ordered.some((outer) => outer.open < region.open && region.close < outer.close));
}
