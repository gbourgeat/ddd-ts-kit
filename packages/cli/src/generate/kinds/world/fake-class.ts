/** The exported class of a fake, and what it may stand for: the types it implements, then the class it extends. */
export interface FakeClass {
  readonly name: string;
  readonly candidates: readonly string[];
}

/** `export class X extends Base<T> implements A, B<U> {`, over as many lines as it takes. */
const HEADER = /\bexport\s+class\s+(\w+)([^{]*)\{/;

/** The first exported class of a source, read from its header. */
export function fakeClass(source: string): FakeClass | undefined {
  const header = HEADER.exec(source);

  if (header === null) {
    return undefined;
  }

  const clause = withoutTypeArguments(header[2] ?? '');
  const implemented = /\bimplements\s+([\w\s.,]+)$/.exec(clause)?.[1] ?? '';
  const extended = /\bextends\s+([\w.]+)/.exec(clause)?.[1];

  const candidates = [...implemented.split(','), ...(extended === undefined ? [] : [extended])]
    .map((candidate) => candidate.trim().split('.').at(-1) ?? '')
    .filter((candidate) => candidate !== '');

  return { name: header[1] ?? '', candidates };
}

/** `Base<Map<string, T>>` becomes `Base`: the commas of type arguments separate nothing here. */
function withoutTypeArguments(clause: string): string {
  let depth = 0;
  let kept = '';

  for (const character of clause) {
    depth += character === '<' ? 1 : 0;

    if (depth === 0) {
      kept += character;
    }

    depth -= character === '>' && depth > 0 ? 1 : 0;
  }

  return kept;
}
