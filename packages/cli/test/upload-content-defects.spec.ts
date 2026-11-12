import { NAMED_ONLY_MEDIA_TYPES, SIGNED_MEDIA_TYPES, TEXT_MEDIA_TYPES, contentRuleDefects } from '@ddd-ts-kit/kernel';
import { describe, expect, it } from 'vitest';
import { KIT_CONTENT_TYPES, NAMED_ONLY_CONTENT_TYPES } from '../src/check/files/kit-content-types';
import { uploadContentDefects } from '../src/check/files/upload-content-defects';
import { uploadDeclarations } from '../src/check/files/upload-declarations';
import { scan } from '../src/check/scan/scan';

interface Declared {
  readonly mediaTypes: readonly string[];
  readonly contentRules?: Readonly<Record<string, 'text' | 'unchecked'>>;
}

/** Uploads a route may write, sound and not: each is judged by the checker on its text and by the kernel on its value. */
const UPLOADS: readonly Declared[] = [
  { mediaTypes: ['application/pdf', 'image/*', 'text/*', 'Text/CSV; charset=utf-8'] },
  { mediaTypes: ['text/csv', 'application/vnd.ms-excel', 'application/octet-stream'] },
  { mediaTypes: ['video/*', '*/*', 'csv', ''] },
  {
    mediaTypes: ['text/csv', 'application/vnd.ms-excel', 'application/octet-stream', 'video/*', 'audio/*'],
    contentRules: {
      'Application/VND.MS-Excel': 'text',
      'application/octet-stream': 'unchecked',
      'video/*': 'unchecked',
      'audio/mpeg': 'unchecked',
    },
  },
  { mediaTypes: ['video/mp4'], contentRules: { 'video/*': 'unchecked' } },
  { mediaTypes: ['video/*'], contentRules: { 'video/mp4': 'unchecked', 'audio/*': 'unchecked' } },
  { mediaTypes: ['application/pdf', 'text/csv'], contentRules: { 'application/pdf': 'unchecked', 'text/csv': 'text' } },
  { mediaTypes: ['image/*', 'image/svg+xml', 'image/x-icon'], contentRules: { 'image/*': 'unchecked' } },
  { mediaTypes: ['image/*', 'Image/SVG+XML'], contentRules: { 'image/*': 'unchecked', 'image/svg+xml': 'text' } },
  { mediaTypes: ['text/*', 'text/html', 'text/javascript'], contentRules: { 'text/*': 'text' } },
];

function written({ mediaTypes, contentRules }: Declared): string {
  const rules = contentRules === undefined ? '' : `, contentRules: ${JSON.stringify(contentRules)}`;

  return `Controller({ upload: { field: 'file', maxBytes: 1, mediaTypes: ${JSON.stringify(mediaTypes)}${rules} } })`;
}

describe('the content rules of an upload, as the checker reads them and as the kernel judges them', () => {
  it('knows the media types the kernel has a rule for, in the same order', () => {
    expect(KIT_CONTENT_TYPES).toEqual([...SIGNED_MEDIA_TYPES, ...TEXT_MEDIA_TYPES]);
  });

  it('knows the media types the kernel lets no family rule reach, in the same order', () => {
    expect(NAMED_ONLY_CONTENT_TYPES).toEqual(NAMED_ONLY_MEDIA_TYPES);
  });

  it.each(UPLOADS.map((upload) => [written(upload), upload] as const))(
    'reports on %s what the declaration of the route refuses',
    (text, { mediaTypes, contentRules }) => {
      const [declaration] = uploadDeclarations(scan(text));

      const refused = contentRuleDefects({
        accepted: mediaTypes,
        ...(contentRules === undefined ? {} : { contentRules }),
      });

      expect(declaration).toBeDefined();

      expect(
        (declaration === undefined ? [] : uploadContentDefects(declaration)).map(({ literal }) => literal.value),
      ).toEqual(refused.map((sentence) => /"([^"]*)"/.exec(sentence)?.[1]));
    },
  );
});
