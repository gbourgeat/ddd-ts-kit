import { describe, expect, it } from 'vitest';
import { contentDisposition } from '../src/index.js';

describe('contentDisposition', () => {
  it('answers a bare attachment for a file without a name', () => {
    expect(contentDisposition()).toBe('attachment');
  });

  it('keeps a plain name as it is, in both forms', () => {
    expect(contentDisposition('report 2026-10.pdf')).toBe(
      `attachment; filename="report 2026-10.pdf"; filename*=UTF-8''report%202026-10.pdf`,
    );
  });

  it('replaces what could break the header in the plain form, and keeps the whole name in the UTF-8 form', () => {
    expect(contentDisposition('relevé "final";\r\nX: y.pdf')).toBe(
      `attachment; filename="relev_ _final____X_ y.pdf"; filename*=UTF-8''relev%C3%A9%20%22final%22%3B%0D%0AX%3A%20y.pdf`,
    );
  });
});
