/** `namespace:name`, or the name alone: one namespace per bounded context keeps their keys apart. */
export function namespaced(namespace: string | undefined, name: string): string {
  return namespace === undefined ? name : `${namespace}:${name}`;
}

/** The glob pattern matching every key that starts with the prefix, whatever it contains. */
export function prefixPattern(prefix: string): string {
  return `${prefix.replaceAll(/[\\*?[\]]/g, '\\$&')}*`;
}
