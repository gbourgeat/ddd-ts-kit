import { AggregateRoot } from '@ddd-ts-kit/kernel';
import { OrganisationOpened } from '{{alias.context}}/domain/events/organisation-opened.event{{alias.ext}}';
import type { OrganisationName } from '{{alias.context}}/domain/value-objects/organisation-name.vo{{alias.ext}}';
import type { OrganisationSlug } from '{{alias.context}}/domain/value-objects/organisation-slug.vo{{alias.ext}}';

export interface OrganisationState {
  readonly name: OrganisationName;
  readonly openedBy: string;
  readonly openedAt: Date;
}

/**
 * A group of accounts that work together: a company, a clinic, a school. Its slug is its identity,
 * and the tenant of its data when the project keeps the data of each organisation apart.
 */
export class Organisation extends AggregateRoot<string> {
  private constructor(
    id: string,
    private readonly state: OrganisationState,
  ) {
    super(id);
  }

  /** Opened by an account, which becomes its first owner (see `OpenOrganisationHandler`). */
  static open(slug: OrganisationSlug, terms: Pick<OrganisationState, 'name' | 'openedBy'>, now: Date): Organisation {
    const opened = new Organisation(slug.value, { ...terms, openedAt: now });

    opened.record(new OrganisationOpened(slug.value, now, { name: terms.name.value, openedBy: terms.openedBy }));

    return opened;
  }

  static rehydrate(id: string, state: OrganisationState): Organisation {
    return new Organisation(id, state);
  }

  get name(): OrganisationName {
    return this.state.name;
  }

  get openedBy(): string {
    return this.state.openedBy;
  }

  get openedAt(): Date {
    return this.state.openedAt;
  }

  toState(): OrganisationState {
    return { ...this.state };
  }
}
