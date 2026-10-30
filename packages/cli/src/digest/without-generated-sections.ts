import { marker } from '../markers/marker';

/** The line that opens any region the kit writes, its name captured: `<!-- ddd-ts-kit:reference -->`, `// ddd-ts-kit:schemas`. */
const OPENING = marker('([\\w-]+)', false);

/** The text with the lines of each region the kit writes left out, its markers kept: what a person wrote in it. */
export function withoutGeneratedSections(text: string): string {
  const kept: string[] = [];
  let open: RegExp | undefined;

  for (const line of text.split('\n')) {
    if (open === undefined) {
      const region = OPENING.exec(line)?.[1];

      open = region === undefined ? undefined : marker(region, true);
      kept.push(line);
    } else if (open.test(line)) {
      open = undefined;
      kept.push(line);
    }
  }

  return kept.join('\n');
}
