import type { ListPart } from './list-part';

/** Splits on the commas met at depth zero, the depth being moved by `depthChange(char, previous)`; empty parts are dropped. */
export function splitAtCommas(text: string, depthChange: (char: string, previous: string) => number): ListPart[] {
  const parts: ListPart[] = [];
  let depth = 0;
  let start = 0;

  for (let i = 0; i <= text.length; i += 1) {
    const char = text.charAt(i);

    depth += char === '' ? 0 : depthChange(char, text.charAt(i - 1));

    if (i < text.length && (char !== ',' || depth !== 0)) {
      continue;
    }

    parts.push(partOf(text, start, i));
    start = i + 1;
  }

  return parts.filter((part) => part.code !== '');
}

function partOf(text: string, from: number, to: number): ListPart {
  const raw = text.slice(from, to);

  return { code: raw.trim(), start: from + raw.length - raw.trimStart().length };
}
