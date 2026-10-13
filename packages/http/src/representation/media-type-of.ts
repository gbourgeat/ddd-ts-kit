/** The media type of a `Content-Type` header, in lower case and without its parameters. */
export function mediaTypeOf(header: string | string[] | undefined): string | undefined {
  const value = Array.isArray(header) ? header[0] : header;
  const mediaType = value?.split(';')[0]?.trim().toLowerCase();

  return mediaType === undefined || mediaType === '' ? undefined : mediaType;
}
