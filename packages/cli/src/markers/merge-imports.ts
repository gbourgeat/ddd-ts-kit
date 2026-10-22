import { LINE_WIDTH } from '../layout';

const NAMED_IMPORT = /^import (type )?\{ ([^}]+) \} from '([^']+)';$/;

/**
 * Adds import lines to those already there; names imported from one module end up in one
 * statement, written one name per line once it no longer fits the line width.
 */
export function mergeImports(present: readonly string[], wanted: readonly string[]): string[] {
  const merged = joined(present);

  for (const line of wanted.map((candidate) => candidate.trim())) {
    const added = NAMED_IMPORT.exec(line);
    const twin = added === null ? -1 : merged.findIndex((existing) => sameSource(NAMED_IMPORT.exec(existing), added));

    if (twin === -1) {
      if (!merged.includes(line)) {
        merged.push(line);
      }

      continue;
    }

    const names = new Set([...namesOf(merged[twin] ?? ''), ...namesOf(line)]);

    merged[twin] = `import ${added?.[1] ?? ''}{ ${[...names].join(', ')} } from '${added?.[3] ?? ''}';`;
  }

  return merged.flatMap(fitted);
}

/** Each import statement on one line, whatever the number of lines it was written on. */
function joined(present: readonly string[]): string[] {
  const statements: string[] = [];
  let open: string[] | undefined;

  for (const line of present.map((candidate) => candidate.trim())) {
    if (open === undefined && /^import (?:type )?\{$/.test(line)) {
      open = [line];
    } else if (open === undefined) {
      statements.push(line);
    } else if (line.startsWith('}')) {
      statements.push(`${open[0] ?? ''} ${open.slice(1).join(' ').replace(/,$/, '')} ${line}`);
      open = undefined;
    } else {
      open.push(line);
    }
  }

  return [...statements, ...(open ?? [])];
}

function fitted(line: string): string[] {
  const named = NAMED_IMPORT.exec(line);

  // One name alone stays on its line, whatever its length.
  if (named === null || line.length <= LINE_WIDTH || namesOf(line).length === 1) {
    return [line];
  }

  return [`import ${named[1] ?? ''}{`, ...namesOf(line).map((name) => `  ${name},`), `} from '${named[3] ?? ''}';`];
}

const sameSource = (left: RegExpExecArray | null, right: RegExpExecArray | null): boolean =>
  left !== null && right !== null && left[1] === right[1] && left[3] === right[3];

const namesOf = (line: string): string[] => (NAMED_IMPORT.exec(line)?.[2] ?? '').split(',').map((name) => name.trim());
