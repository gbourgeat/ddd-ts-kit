const EXPORT = /^export \* from '(.+)';$/;
const CALL = /(?<![\w$.])injected\(\s*([\w$]+)\s*,\s*\[([^\]]*)\]\s*,?\s*\)/g;

/**
 * The first thing that tells a generated file of a context from what its tree says, in words:
 * a role file it does not export, or the class whose dependency list no longer is what its
 * constructor takes.
 */
export function generatedDrift(written: string, expected: string): string {
  return (
    exportDrift(written, expected) ?? listDrift(written, expected) ?? 'it is not laid out as the generator writes it'
  );
}

function exportDrift(written: string, expected: string): string | undefined {
  const exportsOf = (text: string): string[] => text.split('\n').flatMap((line) => EXPORT.exec(line)?.[1] ?? []);
  const missing = exportsOf(expected).find((specifier) => !exportsOf(written).includes(specifier));

  if (missing !== undefined) {
    return `it does not export ${missing}, so the class declared there is registered nowhere`;
  }

  const extra = exportsOf(written).find((specifier) => !exportsOf(expected).includes(specifier));

  return extra === undefined ? undefined : `it exports ${extra}, which is not a role file of the context`;
}

function listDrift(written: string, expected: string): string | undefined {
  const [known, wanted] = [listsOf(written), listsOf(expected)];

  for (const [className, tokens] of wanted) {
    const registered = known.get(className);

    if (registered === undefined) {
      return `it registers no dependency list for ${className}, whose constructor takes [${tokens}]`;
    }

    if (registered !== tokens) {
      return `the dependency list of ${className} is stale: its constructor takes [${tokens}] and the file says [${registered}]`;
    }
  }

  const [gone] = [...known.keys()].filter((className) => !wanted.has(className));

  return gone === undefined
    ? undefined
    : `it registers a dependency list for ${gone}, whose constructor takes nothing the generator reads any more`;
}

/** The token names each `injected(Class, [..])` of a generated file registers, by class. */
function listsOf(text: string): Map<string, string> {
  return new Map(
    [...text.matchAll(CALL)].map(([, className = '', tokens = '']) => [
      className,
      tokens
        .split(',')
        .map((token) => token.trim())
        .filter((token) => token !== '')
        .join(', '),
    ]),
  );
}
