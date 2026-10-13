interface Signature {
  readonly mediaType: string;
  /** Each part at its offset; all must match. */
  readonly parts: readonly (readonly [offset: number, bytes: string])[];
}

/** The leading bytes of the binary formats the kit recognises, written as latin1 strings. */
const SIGNATURES: readonly Signature[] = [
  { mediaType: 'application/pdf', parts: [[0, '%PDF-']] },
  { mediaType: 'image/png', parts: [[0, '\x89PNG\r\n\x1a\n']] },
  { mediaType: 'image/jpeg', parts: [[0, '\xff\xd8\xff']] },
  { mediaType: 'image/gif', parts: [[0, 'GIF8']] },
  {
    mediaType: 'image/webp',
    parts: [
      [0, 'RIFF'],
      [8, 'WEBP'],
    ],
  },
  { mediaType: 'application/zip', parts: [[0, 'PK\x03\x04']] },
  { mediaType: 'application/gzip', parts: [[0, '\x1f\x8b']] },
];

/** The binary format the first bytes of a content announce, or `undefined` when none is recognised. */
export function signatureOf(head: Uint8Array): string | undefined {
  return SIGNATURES.find((signature) => signature.parts.every(([offset, bytes]) => startsWith(head, offset, bytes)))
    ?.mediaType;
}

function startsWith(head: Uint8Array, offset: number, bytes: string): boolean {
  if (head.length < offset + bytes.length) {
    return false;
  }

  return Array.from({ length: bytes.length }, (_, index) => index).every(
    (index) => head[offset + index] === bytes.charCodeAt(index),
  );
}
