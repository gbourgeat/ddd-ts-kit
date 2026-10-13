import type { SourceFile } from '../model/source-file.js';
import { endAtDepthZero } from '../text/end-at-depth-zero.js';

/** One place a member writes the status: `status: <value>` in an object, or `<target>.status = <value>`. */
export interface StatusWrite {
  readonly line: number;
  /** The value as written, literals included. */
  readonly value: string;
}

const PROPERTY = /(?<![\w$.])(['"]?)status\1\s*:(?!:)/g;
const ASSIGNMENT = /\.\s*status\s*=(?![=>])/g;

/** Every write of the status inside the bodies of the members of the classes of a file. */
export function statusWrites(file: SourceFile): StatusWrite[] {
  const bodies = file.structure.classes.flatMap((shape) =>
    shape.methods.map(({ bodyStart, end }) => ({ bodyStart, end })),
  );

  return [PROPERTY, ASSIGNMENT].flatMap((pattern) =>
    [...file.scan.code.matchAll(pattern)]
      .filter(({ index }) => bodies.some(({ bodyStart, end }) => index > bodyStart && index < end))
      .map((match) => writeAt(file, match.index + match[0].length)),
  );
}

function writeAt(file: SourceFile, valueStart: number): StatusWrite {
  const { code } = file.scan;
  const end = Math.min(endAtDepthZero(code, valueStart, ','), endAtDepthZero(code, valueStart, ';'));

  return { line: file.scan.lineAt(valueStart), value: file.text.slice(valueStart, end).trim() };
}
