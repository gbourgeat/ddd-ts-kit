/** The link with its last character changed: the end of the signature, for every connector of the kit. */
export function tampered(url: string): string {
  return `${url.slice(0, -1)}${url.endsWith('A') ? 'B' : 'A'}`;
}
