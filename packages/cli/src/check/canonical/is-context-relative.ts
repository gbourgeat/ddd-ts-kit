import { CONTEXT_LAYERS } from './context-layers';

/** A plain path of a file or a directory, with no placeholder (`<name>`, `*`). */
const PLAIN_PATH = /^[\w$@.-]+(?:\/[\w$@.-]+)*\/?$/;

/** True when a path cited in a document starts with a top directory of a context, and names a `.ts` file or a directory. */
export function isContextRelative(cited: string): boolean {
  const [first = ''] = cited.split('/');

  return (
    cited.includes('/') &&
    PLAIN_PATH.test(cited) &&
    (cited.endsWith('.ts') || cited.endsWith('/')) &&
    CONTEXT_LAYERS.includes(first)
  );
}
