import type { SourceFile } from '../model/source-file';
import { endAtDepthZero } from '../text/end-at-depth-zero';

/** A value a snapshot mapper keeps in clear, by the name it is written or read under. */
export interface ClearSnapshotValue {
  readonly name: string;
  readonly line: number;
}

/** A property of an object or of a type, at the start of its line or after `{` or `,`. */
const PROPERTY = /(?:^|[{,]\s*|\n\s*)([A-Za-z_$][\w$]*)\??\s*:/g;
/** `data.optionalText('email')`, any reader but the personal ones. */
const CLEAR_READ = /\b[\w$]+\.(?!personal)[A-Za-z]+\(\s*'([A-Za-z_$][\w$]*)'/g;
/** What says a value is sealed: `personalData(...)` on the way in, its type, a personal reader on the way out. */
const SEALED = /\bpersonalData\(|\bPersonalValue\b|\.personal(?:Text|Instant)?\(/;

/**
 * The values a snapshot mapper writes in `encode`, reads in `decode` or types, that no
 * `personalData`, `PersonalValue` or personal reader of the same file seals, each name once. Reading
 * the two sides is what sees a mapper whose `encode` answers the whole state.
 */
export function clearSnapshotValuesIn(file: SourceFile): ClearSnapshotValue[] {
  const properties = propertiesIn(file);
  const sealed = new Set(properties.filter(({ value }) => SEALED.test(value)).map(({ name }) => name));

  const named = [
    ...properties.filter(({ value }) => !SEALED.test(value)).map(({ name, line }) => ({ name, line })),
    ...clearReadsIn(file),
  ];

  const kept = named.filter(({ name }) => !sealed.has(name));

  return kept.filter(({ name }, index) => kept.findIndex((value) => value.name === name) === index);
}

interface Property extends ClearSnapshotValue {
  readonly value: string;
}

function propertiesIn({ scan }: SourceFile): Property[] {
  const { code } = scan;

  return [...code.matchAll(PROPERTY)].map((match) => {
    const start = match.index + match[0].length;
    const value = code.slice(start, endAtDepthZero(code, start, ','));

    return { name: match[1] ?? '', line: scan.lineAt(start), value: value.split(';')[0] ?? '' };
  });
}

function clearReadsIn({ text, scan }: SourceFile): ClearSnapshotValue[] {
  return [...text.matchAll(CLEAR_READ)]
    .filter((match) => scan.code.charAt(match.index) === text.charAt(match.index))
    .map((match) => ({ name: match[1] ?? '', line: scan.lineAt(match.index) }));
}
