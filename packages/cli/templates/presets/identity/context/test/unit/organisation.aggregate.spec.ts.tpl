import { describe, expect, it } from '{{tests.module}}';
import { Organisation } from '{{alias.context}}/domain/aggregates/organisation.aggregate{{alias.ext}}';
import { OrganisationName } from '{{alias.context}}/domain/value-objects/organisation-name.vo{{alias.ext}}';
import { OrganisationSlug } from '{{alias.context}}/domain/value-objects/organisation-slug.vo{{alias.ext}}';
import { anOrganisation } from '{{alias.context}}/test/builders/organisation.builder{{alias.ext}}';

const openedAt = new Date('2026-02-01T00:00:00.000Z');

describe('Organisation', () => {
  it('is opened under its slug by an account, and announces its name and its opener', () => {
    const terms = { name: OrganisationName.create('Acme'), openedBy: 'subject-ada' };
    const opened = Organisation.open(OrganisationSlug.create('acme'), terms, openedAt);

    expect([opened.id, opened.name.value, opened.openedBy, opened.openedAt]).toEqual(['acme', 'Acme', 'subject-ada', openedAt]);

    expect(opened.pullEvents()).toEqual([
      {
        name: '{{context.kebab}}.organisation.opened',
        aggregateId: 'acme',
        occurredAt: openedAt,
        facts: { name: 'Acme', openedBy: 'subject-ada' },
      },
    ]);
  });

  it('is rehydrated in its stored state without recording a new fact', () => {
    const stored = anOrganisation().build();
    const loaded = Organisation.rehydrate(stored.id, stored.toState());

    expect(loaded.toState()).toEqual(stored.toState());
    expect(loaded.pullEvents()).toEqual([]);
  });
});
