/** `application/json` and every `+json` suffix, which the JSON body parser of a framework already read. */
export function isJsonMediaType(mediaType: string): boolean {
  return mediaType === 'application/json' || mediaType.endsWith('+json');
}
