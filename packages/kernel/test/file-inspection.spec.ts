import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { describe, expect, it } from 'vitest';
import { FileError, FileInspection, acceptsMediaType, contentMatches, mediaTypeOf, signatureOf } from '../src/index.js';

const bytes = (text: string) => new Uint8Array(Buffer.from(text, 'latin1'));
const PDF = bytes('%PDF-1.7\n%%EOF');
const PNG = bytes('\x89PNG\r\n\x1a\n....');
const DOCX = bytes('PK\x03\x04 word/document.xml');

async function inspected(chunks: readonly Uint8Array[], inspection: FileInspection): Promise<number> {
  let passed = 0;

  await pipeline(
    Readable.from(chunks),
    inspection,
    new Writable({
      write(chunk: Buffer, _encoding, done) {
        passed += chunk.length;
        done();
      },
    }),
  );

  return passed;
}

async function refusalOf(chunks: readonly Uint8Array[], inspection: FileInspection): Promise<string> {
  return inspected(chunks, inspection).then(
    () => 'passed',
    (error: unknown) => (FileError.is(error) ? error.code : String(error)),
  );
}

describe('the media type of a content, read on its bytes', () => {
  it('recognises the signatures of the common binary formats', () => {
    expect(
      [
        PDF,
        PNG,
        DOCX,
        bytes('\xff\xd8\xff\xe0'),
        bytes('GIF89a'),
        bytes('RIFF....WEBPVP8 '),
        bytes('\x1f\x8b\x08'),
      ].map(signatureOf),
    ).toEqual([
      'application/pdf',
      'image/png',
      'application/zip',
      'image/jpeg',
      'image/gif',
      'image/webp',
      'application/gzip',
    ]);

    expect(signatureOf(bytes('RIFF....WAVE'))).toBeUndefined();
    expect(signatureOf(bytes('%P'))).toBeUndefined();
  });

  it('matches a declared type to the bytes, office documents being zip archives', () => {
    expect(contentMatches(PDF, 'application/pdf; charset=binary')).toBe(true);
    expect(contentMatches(PDF, 'image/png')).toBe(false);
    expect(contentMatches(DOCX, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(true);
    expect(contentMatches(DOCX, 'application/pdf')).toBe(false);
  });

  it('takes text for text only when it is UTF-8 without control characters, and never for a binary format', () => {
    expect(contentMatches(bytes('name;date\r\nAda;2026-03-01\n'), 'text/csv')).toBe(true);
    expect(contentMatches(new Uint8Array(Buffer.from('Renée ✓\t')), 'text/plain')).toBe(true);
    expect(contentMatches(bytes('nul\x00inside'), 'text/plain')).toBe(false);
    expect(contentMatches(bytes('\xc3\x28 broken'), 'text/plain')).toBe(false);
    expect(contentMatches(bytes('<svg onload="alert(1)"/>'), 'image/svg+xml')).toBe(false);
  });

  it('accepts a declared type listed exactly or by its family, whatever its case and parameters', () => {
    expect(acceptsMediaType(['application/pdf', 'image/*'], 'Image/PNG')).toBe(true);
    expect(acceptsMediaType(['application/pdf'], 'application/pdf; charset=binary')).toBe(true);
    expect(acceptsMediaType(['application/pdf'], 'text/plain')).toBe(false);
    expect(mediaTypeOf('')).toBe('');
  });
});

describe('FileInspection', () => {
  it('counts and hashes what passes through it', async () => {
    const inspection = new FileInspection();

    expect(await inspected([PDF, PDF], inspection)).toBe(PDF.length * 2);
    expect(inspection.size).toBe(PDF.length * 2);
    expect(inspection.checksum).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('fails beyond its limit', async () => {
    expect(await refusalOf([PDF, PDF], new FileInspection({ maxBytes: PDF.length + 1 }))).toBe('FILE_TOO_LARGE');
  });

  it('lets a content through once its first bytes proved the declared type, even split in small chunks', async () => {
    const expected = { mediaType: 'application/pdf', accepted: ['application/pdf'] };
    const large = new Uint8Array(10_000).fill(65);
    const inspection = new FileInspection({ expected });

    expect(await inspected([PDF.subarray(0, 2), PDF.subarray(2), large], inspection)).toBe(PDF.length + large.length);
  });

  it('refuses before any byte goes on a content that is not what it declares, or not accepted', async () => {
    const pdfOnly = ['application/pdf'];

    expect(
      await refusalOf([PNG], new FileInspection({ expected: { mediaType: 'application/pdf', accepted: pdfOnly } })),
    ).toBe('UNSUPPORTED_MEDIA_TYPE');

    expect(
      await refusalOf([PNG], new FileInspection({ expected: { mediaType: 'image/png', accepted: pdfOnly } })),
    ).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('exposes the accepted types of its refusal, never the key of a missing file', () => {
    expect(FileError.unsupportedMediaType('image/png', ['application/pdf']).exposedFacts).toEqual({
      accepted: 'application/pdf',
    });

    expect(FileError.tooLarge(10).exposedFacts).toEqual({ maxBytes: 10 });
    expect(FileError.notFound('tenants/t1/a').exposedFacts).toEqual({});
  });
});
