import { describe, expect, it } from '{{tests.module}}';
import { expectRefusal } from '@ddd-ts-kit/testing';
import { DisplayName } from '{{alias.context}}/domain/value-objects/display-name.vo{{alias.ext}}';

describe('DisplayName', () => {
  it('is what the person wrote, without the spaces at its ends', () => {
    expect(DisplayName.create('  Grace Hopper ').value).toBe('Grace Hopper');
  });

  it.each(['', '   ', 'x'.repeat(101)])('refuses a name of %s characters out of bounds', (raw) => {
    expectRefusal(() => DisplayName.create(raw), 'INVALID_DISPLAY_NAME', { raw });
  });
});
