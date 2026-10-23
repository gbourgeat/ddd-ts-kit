import { CONTEXT_FILES } from './context-file';

/**
 * Where the workspace reads and writes a file of a context named at its root or where 0.86 and 0.87 wrote
 * it, both from the project root: at the root, unless only the earlier place holds it, so that a
 * project that has not moved yet goes on being written where it is. Any other file is as given.
 * `existsAsIs` says whether a file is at this very path, on disk or planned.
 */
export function contextFilePlacement(
  contextsDir: string,
  existsAsIs: (file: string) => boolean,
): (file: string) => string {
  return (file) => {
    const [context = '', ...rest] = file.startsWith(`${contextsDir}/`)
      ? file.slice(contextsDir.length + 1).split('/')
      : [];

    const relative = rest.join('/');

    const named = CONTEXT_FILES.find((candidate) =>
      [candidate.root(context), candidate.earlier(context)].includes(relative),
    );

    if (named === undefined) {
      return file;
    }

    const root = `${contextsDir}/${context}/${named.root(context)}`;
    const earlier = `${contextsDir}/${context}/${named.earlier(context)}`;

    return !existsAsIs(root) && existsAsIs(earlier) ? earlier : root;
  };
}
