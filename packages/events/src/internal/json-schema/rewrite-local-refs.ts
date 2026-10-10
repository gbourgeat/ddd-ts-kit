import { isRecord } from './is-record.js';
import { localRefName } from './local-ref-name.js';

export function rewriteLocalRefs(node: unknown, rename: (name: string) => string | undefined): unknown {
  if (Array.isArray(node)) {
    return node.map((item) => rewriteLocalRefs(item, rename));
  }

  if (!isRecord(node)) {
    return node;
  }

  return Object.fromEntries(
    Object.entries(node).map(([key, value]) => {
      if (key === '$ref') {
        const name = localRefName(value);
        const target = name === undefined ? undefined : rename(name);

        return [key, target ?? value];
      }

      return [key, rewriteLocalRefs(value, rename)];
    }),
  );
}
