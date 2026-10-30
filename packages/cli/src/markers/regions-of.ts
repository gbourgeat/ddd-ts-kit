import { REGION_MARKER } from './region-marker';

/** A generated region of a text: its name and the lines of its two markers. */
export interface Region {
  readonly name: string;
  readonly open: number;
  readonly close: number;
}

/** The regions of a text, in their order, each closed after it opens. What a region holds is its own: one written inside another is not listed. */
export function regionsOf(lines: readonly string[]): Region[] {
  const regions: Region[] = [];
  let open: { name: string; at: number } | undefined;

  lines.forEach((line, at) => {
    const [, closing, name] = REGION_MARKER.exec(line) ?? [];

    if (name !== undefined && closing === '' && open === undefined) {
      open = { name, at };
    } else if (name !== undefined && closing === '/' && open?.name === name) {
      regions.push({ name, open: open.at, close: at });
      open = undefined;
    }
  });

  return regions;
}
