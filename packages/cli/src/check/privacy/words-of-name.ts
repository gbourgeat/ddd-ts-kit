/** The lower-case words of a name written in camel case, snake case, kebab case or a path: `customer.homePhone` gives `customer`, `home`, `phone`. */
export function wordsOfName(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word !== '');
}
