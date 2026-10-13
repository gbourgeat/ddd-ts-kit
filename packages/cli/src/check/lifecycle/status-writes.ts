import type { SourceFile } from '../model/source-file.js';
import { endAtDepthZero } from '../text/end-at-depth-zero.js';
import { shorthandStatusWrites } from './shorthand-status-writes.js';

/**
 * One place a member writes the status: `status: <value>` in an object, `<target>.status =
 * <value>`, or the shorthand `{ ...this.state, status }`, whose value is that of the local
 * `const status = <value>` when the file declares one.
 */
export interface StatusWrite {
  readonly line: number;
  /** The value as written, literals included. */
  readonly value: string;
}

const LOCAL = /\b(?:const|let)\s+status\s*(?::[^=]+)?=(?![=>])/g;

const PROPERTY = /(?<![\w$.])(['"]?)status\1\s*:(?!:)/g;
const ASSIGNMENT = /\.\s*status\s*=(?![=>])/g;

/** Every write of the status inside the bodies of the members of the classes of a file. */
export function statusWrites(file: SourceFile): StatusWrite[] {
  const bodies = file.structure.classes.flatMap((shape) =>
    shape.methods.map(({ bodyStart, end }) => ({ bodyStart, end })),
  );

  const inBody = (index: number) => bodies.some(({ bodyStart, end }) => index > bodyStart && index < end);

  const written = [PROPERTY, ASSIGNMENT].flatMap((pattern) =>
    [...file.scan.code.matchAll(pattern)]
      .filter(({ index }) => inBody(index))
      .map((match) => writeAt(file, match.index + match[0].length)),
  );

  const locals = [...file.scan.code.matchAll(LOCAL)].map((match) => writeAt(file, match.index + match[0].length));

  const shorthands = shorthandStatusWrites(file)
    .filter(inBody)
    .flatMap((index) => shorthandAt(file, index, locals));

  return [...written, ...shorthands];
}

/** A shorthand takes the values of the local bindings of the file; without one, it copies a status read. */
function shorthandAt(file: SourceFile, index: number, locals: readonly StatusWrite[]): StatusWrite[] {
  const line = file.scan.lineAt(index);

  return locals.length === 0 ? [{ line, value: 'status' }] : locals.map(({ value }) => ({ line, value }));
}

function writeAt(file: SourceFile, valueStart: number): StatusWrite {
  const { code } = file.scan;
  const end = Math.min(endAtDepthZero(code, valueStart, ','), endAtDepthZero(code, valueStart, ';'));

  return { line: file.scan.lineAt(valueStart), value: file.text.slice(valueStart, end).trim() };
}
