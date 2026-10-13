import { describe, expect, it } from '{{tests.module}}';
import { expectRefusal } from '@ddd-ts-kit/testing';
import { OrganisationName } from '{{alias.context}}/domain/value-objects/organisation-name.vo{{alias.ext}}';

describe('OrganisationName', () => {
  it('is free text, without the spaces at its ends', () => {
    expect(OrganisationName.create(' Acme & Sons ').value).toBe('Acme & Sons');
  });

  it.each(['', '  ', 'x'.repeat(101)])('refuses "%s"', (raw) => {
    expectRefusal(() => OrganisationName.create(raw), 'INVALID_ORGANISATION_NAME', { raw });
  });
});
