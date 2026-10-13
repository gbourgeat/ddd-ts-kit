import { describe, expect, it } from '{{tests.module}}';
import { expectRefusal } from '@ddd-ts-kit/testing';
import { OrganisationSlug } from '{{alias.context}}/domain/value-objects/organisation-slug.vo{{alias.ext}}';

describe('OrganisationSlug', () => {
  it('is lower-case letters, digits and hyphens, up to 63 of them', () => {
    expect(OrganisationSlug.create(' Acme-42 ').value).toBe('acme-42');
    expect(OrganisationSlug.create('a'.repeat(63)).value).toHaveLength(63);
  });

  it.each(['', 'a', '-acme', 'acme_42', 'acme.org', 'acme corp', 'a'.repeat(64)])(
    'refuses "%s", which names no tenant',
    (raw) => {
      expectRefusal(() => OrganisationSlug.create(raw), 'INVALID_ORGANISATION_SLUG', { raw });
    },
  );
});
