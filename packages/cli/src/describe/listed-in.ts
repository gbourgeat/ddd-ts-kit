/** The entries of the list an option of a decorator holds, as they are written: `guards: [Authenticated, HasRole('admin')]`. */
export function listedIn(options: string, key: string): string[] {
  const written = new RegExp(String.raw`\b${key}:\s*\[([^\]]*)\]`).exec(options)?.[1] ?? '';

  return written
    .split(/,(?![^(]*\))/)
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
}
