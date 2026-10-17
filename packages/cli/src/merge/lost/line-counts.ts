import { normalizedLines } from './normalized-lines.js';

type Place = { readonly file: string; readonly line: number };

/**
 * How many times each normalized line occurs over a set of files, and where. Counted over the
 * whole set rather than file by file, so that a line moved to another file, or a file renamed,
 * is neither lost nor added.
 */
export class LineCounts {
  private constructor(private readonly placesOf: ReadonlyMap<string, readonly Place[]>) {}

  static of(files: ReadonlyMap<string, string>): LineCounts {
    const placesOf = new Map<string, Place[]>();

    for (const [file, content] of files) {
      for (const { text, line } of normalizedLines(content)) {
        const places = placesOf.get(text) ?? [];

        places.push({ file, line });
        placesOf.set(text, places);
      }
    }

    return new LineCounts(placesOf);
  }

  texts(): IterableIterator<string> {
    return this.placesOf.keys();
  }

  count(text: string): number {
    return this.places(text).length;
  }

  places(text: string): readonly Place[] {
    return this.placesOf.get(text) ?? [];
  }
}
