import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { describe, expect, it } from 'vitest';
import {
  FileError,
  FileInspection,
  SIGNED_MEDIA_TYPES,
  TEXT_MEDIA_TYPES,
  contentMatches,
  contentRuleDefects,
  contentRuleOf,
  isUtf8,
  type ContentExpectation,
} from '../src';

const bytes = (text: string) => new Uint8Array(Buffer.from(text, 'latin1'));
/** A bank export as Windows writes it: accented letters and the euro sign as single bytes. */
const WINDOWS_1252 = bytes('Libell\xe9;Montant\r\nCaf\xe9 cr\xe8me;3,50 \x80\r\n');
const UTF_8 = new Uint8Array(Buffer.from('Libellé;Montant\r\nCafé crème;3,50 €\r\n', 'utf8'));
const PDF = bytes('%PDF-1.7\n%%EOF');
const PNG = bytes('\x89PNG\r\n\x1a\n....');
const XLS = bytes('\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1\x00\x00');
const SINGLE_BYTE = { text: 'single-byte' } as const;

async function refusalOf(content: Uint8Array, expected: ContentExpectation): Promise<string> {
  const sink = new Writable({ write: (_chunk, _encoding, done) => done() });

  return pipeline(Readable.from([content]), new FileInspection({ expected }), sink).then(
    () => 'passed',
    (error: unknown) => (FileError.is(error) ? error.code : String(error)),
  );
}

describe('the text a route takes', () => {
  it('is UTF-8 alone unless the route says otherwise: a single-byte export is refused by default', () => {
    expect(contentMatches(UTF_8, 'text/csv')).toBe(true);
    expect(contentMatches(WINDOWS_1252, 'text/csv')).toBe(false);
    expect(contentMatches(WINDOWS_1252, 'text/csv', { text: 'utf-8' })).toBe(false);
  });

  it('takes UTF-8 and single-byte encodings alike once the route says single-byte', () => {
    expect(contentMatches(WINDOWS_1252, 'text/csv', SINGLE_BYTE)).toBe(true);
    expect(contentMatches(UTF_8, 'text/csv', SINGLE_BYTE)).toBe(true);
    expect(contentMatches(bytes('a\tb\x0c\r\n'), 'application/csv', SINGLE_BYTE)).toBe(true);
    expect(contentMatches(bytes(''), 'text/tab-separated-values', SINGLE_BYTE)).toBe(true);
  });

  it('still refuses a binary file declared as text: a signature, a NUL, a control character', () => {
    for (const binary of [PDF, PNG, XLS, bytes('PK\x03\x04'), bytes('\x7fELF\x02\x01\x01'), bytes('a;b\x00c')]) {
      expect(contentMatches(binary, 'text/csv', SINGLE_BYTE)).toBe(false);
      expect(contentMatches(binary, 'text/csv')).toBe(false);
    }

    expect(contentMatches(bytes('bell\x07'), 'text/plain', SINGLE_BYTE)).toBe(false);
  });

  it('refuses UTF-16 and UTF-32 under both rules, by their byte order mark even without a NUL', () => {
    const utf16 = new Uint8Array(Buffer.from('﻿Libellé;Montant', 'utf16le'));

    expect(contentMatches(utf16, 'text/csv', SINGLE_BYTE)).toBe(false);
    expect(contentMatches(utf16, 'text/csv')).toBe(false);
    expect(contentMatches(bytes('\xff\xfe\x42\x30\x44\x30'), 'text/csv', SINGLE_BYTE)).toBe(false);
    expect(contentMatches(bytes('\xfe\xff\x30\x42\x30\x44'), 'text/csv', SINGLE_BYTE)).toBe(false);
    expect(contentMatches(bytes('\xfe\xe9t\xe9'), 'text/csv', SINGLE_BYTE)).toBe(true);
    expect(contentMatches(bytes('\xff'), 'text/csv', SINGLE_BYTE)).toBe(true);
  });

  it('tells a reader whether the bytes it received are UTF-8, so that it decodes them right', () => {
    expect([isUtf8(UTF_8), isUtf8(WINDOWS_1252), isUtf8(bytes('plain ascii'))]).toEqual([true, false, true]);
    expect(new TextDecoder(isUtf8(WINDOWS_1252) ? 'utf-8' : 'windows-1252').decode(WINDOWS_1252)).toContain('3,50 €');
  });

  it('reaches the inspection of a stream through the expectation', async () => {
    const accepted = ['text/csv'];

    expect(await refusalOf(WINDOWS_1252, { mediaType: 'text/csv', accepted })).toBe('UNSUPPORTED_MEDIA_TYPE');
    expect(await refusalOf(WINDOWS_1252, { mediaType: 'text/csv', accepted, ...SINGLE_BYTE })).toBe('passed');
    expect(await refusalOf(XLS, { mediaType: 'text/csv', accepted, ...SINGLE_BYTE })).toBe('UNSUPPORTED_MEDIA_TYPE');
  });
});

describe('the content rule of a media type', () => {
  it('is the one of the kit for the types it knows: a signature, or text', () => {
    expect(SIGNED_MEDIA_TYPES.map((type) => contentRuleOf(type))).toEqual(SIGNED_MEDIA_TYPES.map(() => 'signature'));
    expect(TEXT_MEDIA_TYPES.map((type) => contentRuleOf(type))).toEqual(TEXT_MEDIA_TYPES.map(() => 'text'));
    expect(contentRuleOf('Text/CSV; charset=windows-1252')).toBe('text');
  });

  it('is undefined for a type nobody gave a rule to, which then never matches', () => {
    for (const type of ['application/vnd.ms-excel', 'application/octet-stream', 'image/svg+xml', 'video/mp4', '']) {
      expect(contentRuleOf(type)).toBeUndefined();
      expect(contentMatches(bytes('a;b\n'), type)).toBe(false);
    }
  });

  it('is the one the route states: text for the CSV a browser on Windows names a spreadsheet', () => {
    const contentRules = { 'Application/VND.MS-Excel': 'text' } as const;

    expect(contentRuleOf('application/vnd.ms-excel', contentRules)).toBe('text');
    expect(contentMatches(UTF_8, 'application/vnd.ms-excel', { contentRules })).toBe(true);
    expect(contentMatches(WINDOWS_1252, 'application/vnd.ms-excel', { contentRules })).toBe(false);
    expect(contentMatches(WINDOWS_1252, 'application/vnd.ms-excel', { contentRules, ...SINGLE_BYTE })).toBe(true);
    expect(contentMatches(XLS, 'application/vnd.ms-excel', { contentRules, ...SINGLE_BYTE })).toBe(false);
  });

  it('is unchecked when the route says it takes the bytes as they are, by type or by family', () => {
    const contentRules = {
      'application/octet-stream': 'unchecked',
      'video/*': 'unchecked',
      'video/x-notes': 'text',
    } as const;

    expect(contentMatches(XLS, 'application/octet-stream', { contentRules })).toBe(true);
    expect(contentMatches(PDF, 'application/octet-stream', { contentRules })).toBe(true);
    expect(contentMatches(XLS, 'video/mp4', { contentRules })).toBe(true);
    expect(contentMatches(XLS, 'video/x-notes', { contentRules })).toBe(false);
    expect(contentMatches(XLS, 'audio/mpeg', { contentRules })).toBe(false);
  });
});

describe('the defects of the media types an upload accepts', () => {
  it('finds none when each accepted type has a rule, of the kit or stated', () => {
    expect(contentRuleDefects({ accepted: ['application/pdf', 'image/*', 'text/*', 'Text/CSV'] })).toEqual([]);

    expect(
      contentRuleDefects({
        accepted: ['text/csv', 'application/vnd.ms-excel', 'application/octet-stream', 'video/*', 'audio/*'],
        contentRules: {
          'application/vnd.ms-excel': 'text',
          'application/octet-stream': 'unchecked',
          'video/*': 'unchecked',
          'audio/mpeg': 'unchecked',
        },
      }),
    ).toEqual([]);
  });

  it('names each accepted type no content could prove, and says how to state its rule', () => {
    const defects = contentRuleDefects({
      accepted: ['text/csv', 'application/vnd.ms-excel', 'application/octet-stream', 'video/*'],
    });

    expect(defects).toHaveLength(3);
    expect(defects[0]).toContain('"application/vnd.ms-excel" has no content rule');
    expect(defects[0]).toContain("'text' (held to the text rule) or 'unchecked'");
    expect(defects[2]).toContain('"video/*" has no content rule');
  });

  it('names an entry that is no media type: a wildcard for everything, a bare word', () => {
    expect(contentRuleDefects({ accepted: ['*/*', 'csv', ''] })).toEqual([
      '"*/*" is neither a media type nor a family of them (`image/*`): no file is ever of it.',
      '"csv" is neither a media type nor a family of them (`image/*`): no file is ever of it.',
      '"" is neither a media type nor a family of them (`image/*`): no file is ever of it.',
    ]);
  });

  it('names a stated rule that does nothing: for a type the kit verifies, or one not accepted', () => {
    const defects = contentRuleDefects({
      accepted: ['application/pdf', 'text/csv'],
      contentRules: {
        'application/pdf': 'unchecked',
        'text/csv': 'text',
        'video/*': 'unchecked',
        'audio/mpeg': 'text',
      },
    });

    expect(defects).toEqual([
      '`contentRules` states "application/pdf", which the kit already verifies (signature): a stated rule does not replace it. Remove it.',
      '`contentRules` states "text/csv", which the kit already verifies (text): a stated rule does not replace it. Remove it.',
      '`contentRules` states "video/*", which is not one of the accepted media types: add it there, or remove it.',
      '`contentRules` states "audio/mpeg", which is not one of the accepted media types: add it there, or remove it.',
    ]);
  });
});
