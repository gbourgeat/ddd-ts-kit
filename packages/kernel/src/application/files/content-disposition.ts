/** `attachment` with the name, kept to characters that cannot break the header, and its UTF-8 form. */
export function contentDisposition(fileName: string): string {
  const plain = fileName.replace(/[^A-Za-z0-9._ -]/g, '_');

  return `attachment; filename="${plain}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
