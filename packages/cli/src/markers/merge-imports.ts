const NAMED_IMPORT = /^import (type )?\{ ([^}]+) \} from '([^']+)';$/;

/** Adds import lines to those already there; names imported from one module end up on one line. */
export function mergeImports(present: readonly string[], wanted: readonly string[]): string[] {
  const merged = [...present];

  for (const line of wanted.map((candidate) => candidate.trim())) {
    const added = NAMED_IMPORT.exec(line);
    const twin = added === null ? -1 : merged.findIndex((existing) => sameSource(NAMED_IMPORT.exec(existing), added));

    if (twin === -1) {
      if (!merged.includes(line)) merged.push(line);

      continue;
    }

    const names = new Set([...namesOf(merged[twin] ?? ''), ...namesOf(line)]);

    merged[twin] = `import ${added?.[1] ?? ''}{ ${[...names].join(', ')} } from '${added?.[3] ?? ''}';`;
  }

  return merged;
}

const sameSource = (left: RegExpExecArray | null, right: RegExpExecArray | null): boolean =>
  left !== null && right !== null && left[1] === right[1] && left[3] === right[3];

const namesOf = (line: string): string[] => (NAMED_IMPORT.exec(line)?.[2] ?? '').split(',').map((name) => name.trim());
