import path from 'node:path';

/** The relative specifier from one directory of the project to another, always starting with a dot. */
export function relativeTo(from: string, to: string): string {
  const result = path.posix.relative(from, to);

  return result.startsWith('.') ? result : `./${result}`;
}
