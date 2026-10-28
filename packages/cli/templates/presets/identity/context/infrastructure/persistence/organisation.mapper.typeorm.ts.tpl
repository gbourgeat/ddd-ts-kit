import { Organisation } from '{{alias.context}}/domain/aggregates/organisation.aggregate{{alias.ext}}';
import { OrganisationName } from '{{alias.context}}/domain/value-objects/organisation-name.vo{{alias.ext}}';
import type { OrganisationColumns, OrganisationRow } from '{{alias.context}}/infrastructure/persistence/organisation-row.schema{{alias.ext}}';

export const OrganisationMapper = {
  toDomain(row: OrganisationRow): Organisation {
    const loaded = Organisation.rehydrate(row.id, {
      name: OrganisationName.create(row.name),
      openedBy: row.openedBy,
      openedAt: row.openedAt,
    });

    loaded.version = row.version;

    return loaded;
  },

  toRow(saved: Organisation): OrganisationColumns {
    const state = saved.toState();

    return { id: saved.id, name: state.name.value, openedBy: state.openedBy, openedAt: state.openedAt };
  },
};
