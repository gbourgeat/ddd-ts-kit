/** A JSON media type: `application/json`, or one of its structured suffix (`application/problem+json`). */
export function isJson(mediaType: string): boolean {
  return mediaType === 'application/json' || mediaType.endsWith('+json');
}
