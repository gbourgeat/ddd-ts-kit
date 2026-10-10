import { isRecord } from '../support/is-record.js';

const COMMENT = /("(?:[^"\\]|\\.)*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g;
const TRAILING_COMMA = /("(?:[^"\\]|\\.)*")|,(\s*[}\]])/g;

/** A JSON object as tsconfig allows it, comments and trailing commas included; nothing when it cannot be read. */
export function parseJsonc(text: string): Record<string, unknown> | undefined {
  const plain = text
    .replace(COMMENT, (_match, literal?: string) => literal ?? '')
    .replace(TRAILING_COMMA, (_match, literal?: string, closing?: string) => literal ?? closing ?? '');

  try {
    const parsed: unknown = JSON.parse(plain);

    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}
