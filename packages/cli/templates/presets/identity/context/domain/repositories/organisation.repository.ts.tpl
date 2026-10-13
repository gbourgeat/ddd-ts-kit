import { Repository } from '@ddd-ts-kit/kernel';
import type { Organisation } from '{{alias.context}}/domain/aggregates/organisation.aggregate{{alias.ext}}';

/** The organisations, by their slug. */
export abstract class OrganisationRepository extends Repository<Organisation> {}
