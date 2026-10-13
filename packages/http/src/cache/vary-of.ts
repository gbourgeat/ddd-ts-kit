/** The request headers of several lists, once each whatever their case, in the spelling first met. */
export function varyOf(...lists: readonly (readonly string[])[]): string[] {
  const byName = new Map<string, string>();

  for (const name of lists.flat()) {
    if (!byName.has(name.toLowerCase())) {
      byName.set(name.toLowerCase(), name);
    }
  }

  return [...byName.values()];
}
