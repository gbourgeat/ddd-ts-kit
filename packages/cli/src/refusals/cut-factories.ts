import { scan } from '../check/scan/scan.js';
import { classBody } from '../generate/errors/class-body.js';
import type { ConceptFactory } from './concept-error-class.js';
import { importsUsedBy } from './imports-used-by.js';

const IMPORT = /^import [^;]+;\n/gm;

/**
 * The file of a concept class without the factories that moved, and without the imports only they
 * read. Undefined when the class is left empty: the file goes.
 */
export function cutFactories(source: string, className: string, moved: readonly ConceptFactory[]): string | undefined {
  const cut = [...moved]
    .sort((a, b) => b.start - a.start)
    .reduce((text, factory) => {
      const lineEnd = text.indexOf('\n', factory.end);

      return text.slice(0, factory.start) + text.slice(lineEnd === -1 ? text.length : lineEnd + 1);
    }, source);

  const scanned = scan(cut);
  const body = classBody(scanned, className);
  const inside = body === undefined ? '' : cut.slice(body.open + 1, body.close);

  if (body === undefined || inside.trim() === '') {
    return undefined;
  }

  const tidy = `\n${inside
    .replace(/^\n+/, '')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()}\n`;

  const kept = cut.slice(0, body.open + 1) + tidy + cut.slice(body.close);
  const rest = kept.replace(IMPORT, '');

  return kept.replace(IMPORT, (line) => importsUsedBy([line], rest)[0] ?? '');
}
