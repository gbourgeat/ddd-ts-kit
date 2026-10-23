import type { Scan } from '../check/scan/scan';

const CALL = /(?<![\w$.])(?:import|require)\s*\(\s*/g;

/**
 * The lines where `import()` or `require()` is given a template with an interpolation that starts
 * with one of the prefixes: the file it names is only known when the code runs, so nothing can
 * rewrite it.
 */
export function computedImports(source: string, scanned: Scan, prefixes: readonly string[]): number[] {
  const literals = new Set(scanned.strings.map(({ start }) => start));

  return [...scanned.code.matchAll(CALL)].flatMap((call) => {
    const at = call.index + call[0].length;
    const interpolated = source[at] === '`' && !literals.has(at);

    return interpolated && prefixes.some((prefix) => source.startsWith(prefix, at + 1)) ? [scanned.lineAt(at)] : [];
  });
}
