import type { SourceFile } from '../model/source-file';
import { blank } from '../scan/blank';
import type { ClassShape } from '../structure/class-shape';
import { BRACKETS } from '../text/brackets';
import { matchingBracket } from '../text/matching-bracket';

/** A member of a class that has no body: a property or a signature, as its blanked text and its line. */
export interface BodilessMember {
  readonly text: string;
  readonly line: number;
}

/** The members of a class written without a body, their parameter lists and type literals emptied. */
export function bodilessMembers(file: SourceFile, shape: ClassShape): BodilessMember[] {
  let body = file.scan.code.slice(shape.bodyStart + 1, shape.end);

  for (const method of shape.methods) {
    body = erase(body, method.start - shape.bodyStart - 1, method.end - shape.bodyStart);
  }

  return statementsOf(emptyBrackets(body)).map(({ text, at }) => ({
    text,
    line: file.scan.lineAt(shape.bodyStart + 1 + at),
  }));
}

function erase(text: string, from: number, to: number): string {
  return text.slice(0, from) + blank(text.slice(from, to)) + text.slice(to);
}

/** Blanks what brackets hold, so that a `;` or a `=` inside a parameter list or an object type does not count. */
function emptyBrackets(text: string): string {
  let emptied = text;
  let at = 0;

  while (at < emptied.length) {
    if (BRACKETS.openers.includes(emptied.charAt(at))) {
      const close = matchingBracket(emptied, at);

      emptied = erase(emptied, at + 1, close);
      at = close;
    }

    at += 1;
  }

  return emptied;
}

function statementsOf(text: string): { text: string; at: number }[] {
  const statements: { text: string; at: number }[] = [];
  let start = 0;

  for (const part of text.split(';')) {
    const trimmed = part.trim();

    if (trimmed !== '') {
      statements.push({ text: trimmed.replace(/\s+/g, ' '), at: start + part.length - part.trimStart().length });
    }

    start += part.length + 1;
  }

  return statements;
}
