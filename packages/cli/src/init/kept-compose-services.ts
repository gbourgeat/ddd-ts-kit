/** One service of a compose file: its name, and the lines it takes, the comment above it and the blank line before it included. */
interface Service {
  readonly name: string;
  readonly from: number;
  readonly to: number;
}

const SERVICE = /^ {2}([\w.-]+):\s*$/;

/**
 * The services of the compose file that the template does not write (`generate service`, those of
 * the team) stay, as they stand and where they stood among the others.
 */
export function keptComposeServices(written: string, existing: string): string {
  const before = existing.split('\n');
  const known = servicesOf(before);
  const after = written.split('\n');

  known.forEach((service, index) => {
    const here = servicesOf(after);

    if (!here.some(({ name }) => name === service.name)) {
      after.splice(placeOf(known.slice(index + 1), here), 0, ...before.slice(service.from, service.to));
    }
  });

  return after.join('\n');
}

/** Where a service goes: before the first of those that followed it and that the text still holds, or after the last service. */
function placeOf(following: readonly Service[], here: readonly Service[]): number {
  const next = following.flatMap(({ name }) => here.filter((service) => service.name === name)).at(0);

  return next?.from ?? here.at(-1)?.to ?? 0;
}

function servicesOf(lines: readonly string[]): Service[] {
  const first = lines.indexOf('services:') + 1;
  const end = lines.findIndex((line, index) => index >= first && /^\S/.test(line));
  const last = end === -1 ? lines.length : end;
  const heads = lines.flatMap((line, at) => (at >= first && at < last && SERVICE.test(line) ? [at] : []));

  return heads.map((head, index) => ({
    name: SERVICE.exec(lines[head] ?? '')?.[1] ?? '',
    from: startOf(lines, head),
    to: startOf(lines, heads[index + 1] ?? last),
  }));
}

/** The first line of the block of a service: the comment and the blank lines above its name are its own. */
function startOf(lines: readonly string[], head: number): number {
  let start = head;

  while (/^\s*(?:#.*)?$/.test(lines[start - 1] ?? 'end')) {
    start -= 1;
  }

  return start;
}
