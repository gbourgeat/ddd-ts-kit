import { scan } from '../check/scan/scan';
import { escapeRegExp } from '../check/text/escape-reg-exp';

/** Told what still names a concept class that is gone, with its line: what to write there is a decision. */
export type OnLeft = (line: number, note: string) => void;

const IMPORT_LINE = /^\s*import\s/;

/** Tells every place of the code that still names `concept`, its import lines aside. */
export function conceptLeftovers(source: string, concept: string, onLeft: OnLeft): void {
  const scanned = scan(source);
  const name = escapeRegExp(concept);

  for (const match of scanned.code.matchAll(new RegExp(`(?<![\\w$.])${name}(?![\\w$])`, 'g'))) {
    const lineStart = scanned.code.lastIndexOf('\n', match.index - 1) + 1;

    if (!IMPORT_LINE.test(scanned.code.slice(lineStart, match.index))) {
      const before = scanned.code.slice(lineStart, match.index);
      const after = scanned.code.slice(match.index + match[0].length);

      onLeft(scanned.lineAt(match.index), noteOn(concept, { before, after }));
    }
  }
}

function noteOn(concept: string, { before, after }: { before: string; after: string }): string {
  if (/CodeOf\s*<\s*typeof\s+$/.test(before)) {
    return `\`CodeOf<typeof ${concept}>\` names the codes of a class that is gone: write the union of the codes it means, or the code type of codes.ts.`;
  }

  if (/^\s*\.\s*is\s*\(/.test(after)) {
    return `\`${concept}.is(..)\` without a code narrowed to every refusal of the concept: write the refusals it means, \`<Refusal>.is(error) || ..\`.`;
  }

  return `${concept} is gone: name the refusal classes that replace it there.`;
}
