/** The lines of a JSDoc comment holding a description, at an indentation; none without one. */
export function docComment(description: unknown, indent: string): string[] {
  if (typeof description !== 'string' || description.trim() === '') {
    return [];
  }

  const lines = description.trim().replaceAll('*/', '*\\/').split('\n');

  return lines.length === 1
    ? [`${indent}/** ${lines[0] ?? ''} */`]
    : [`${indent}/**`, ...lines.map((line) => `${indent} *${line === '' ? '' : ` ${line}`}`), `${indent} */`];
}
