const AUTH_IMPORT = /^import (type )?\{([^}]*)\} from '@ddd-ts-kit\/auth';$/m;

/**
 * The source importing `member` from `@ddd-ts-kit/auth` as well, in the import it already has
 * from there (a type-only import becomes one of values and types), or in a new one.
 */
export function withAuthorizerImport(source: string, member: string): string {
  const found = AUTH_IMPORT.exec(source);

  if (found === null) {
    return `import { ${member} } from '@ddd-ts-kit/auth';\n${source}`;
  }

  const [line, typeOnly, members = ''] = found;

  const present = members
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '')
    .map((name) => (typeOnly === undefined || name.startsWith('type ') ? name : `type ${name}`));

  return source.replace(line, `import { ${orderedMembers([...present, member]).join(', ')} } from '@ddd-ts-kit/auth';`);
}

/** Values first, then types, each in alphabetical order, as the generated imports are written. */
function orderedMembers(members: readonly string[]): string[] {
  const named = (member: string): string => member.replace(/^type /, '');
  const byName = (left: string, right: string): number => named(left).localeCompare(named(right));
  const values = members.filter((member) => !member.startsWith('type ')).sort(byName);
  const types = members.filter((member) => member.startsWith('type ')).sort(byName);

  return [...new Set([...values, ...types])];
}
