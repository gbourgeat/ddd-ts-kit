import { scan } from '../../check/scan/scan.js';
import { matchingBracket } from '../../check/text/matching-bracket.js';

const DESCRIBE = /(?<![\w$.])describe\s*\(/;

/**
 * The spec of an error class with one more case at the end of its first `describe`. Undefined
 * when the spec has no `describe`; the source itself when it already calls the factory.
 */
export function addSpecCase(source: string, factoryCall: string, text: string): string | undefined {
  if (source.includes(factoryCall)) {
    return source;
  }

  const { code } = scan(source);
  const described = DESCRIBE.exec(code);

  if (described === null) {
    return undefined;
  }

  const callback = code.indexOf('{', described.index);
  const close = callback === -1 ? -1 : matchingBracket(code, callback);

  if (close <= callback) {
    return undefined;
  }

  const before = source.slice(0, close).trimEnd();

  // The first case of an empty block follows its opening line; the others are a blank line apart.
  return `${before}${before.endsWith('{') ? '\n' : '\n\n'}${text}\n${source.slice(close)}`;
}
