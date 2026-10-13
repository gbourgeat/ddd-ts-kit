/** `Image/PNG; charset=binary` is `image/png`: the essence of a media type, which is what is compared. */
export function mediaTypeOf(contentType: string): string {
  return (contentType.split(';')[0] ?? '').trim().toLowerCase();
}
