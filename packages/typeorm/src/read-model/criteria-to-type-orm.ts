import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import type { CriteriaPlan, Sort } from '@ddd-ts-kit/kernel';
import { predicateToTypeOrm, type TypeOrmCriteriaOptions } from './predicate-to-type-orm.js';

/**
 * Adds a criteria plan to a query builder on the entity of a read model: its filters and the
 * scope of the actor, the keyset of a cursor page, the total order and the window.
 * `criteriaToTypeOrm(manager.createQueryBuilder(appointments, 'row'), plan, { alias: 'row' }).getMany()`,
 * then `pageOfPlan(plan, rows)`. The fields of the plan are the properties of the entity.
 */
export function criteriaToTypeOrm<Entity extends ObjectLiteral>(
  builder: SelectQueryBuilder<Entity>,
  plan: CriteriaPlan,
  options: TypeOrmCriteriaOptions,
): SelectQueryBuilder<Entity> {
  const { alias, properties = {} } = options;

  const parameters = options.parameters ?? 'criteria';

  predicateToTypeOrm(builder, plan.filter, { ...options, parameters: `${parameters}_filter` });
  predicateToTypeOrm(builder, plan.seek, { ...options, parameters: `${parameters}_seek` });

  for (const sort of plan.sort) ordered(builder, sort, { column: `${alias}.${propertyOf(properties, sort.field)}`, nullable: plan.fields[sort.field]?.nullable === true });

  builder.limit(plan.fetch);

  return plan.offset > 0 ? builder.offset(plan.offset) : builder;
}

interface Ordered {
  readonly column: string;
  readonly nullable: boolean;
}

function ordered<Entity extends ObjectLiteral>(builder: SelectQueryBuilder<Entity>, { direction }: Sort, { column, nullable }: Ordered): void {
  const ascending = direction === 'asc';

  if (nullable) builder.addOrderBy(column, ascending ? 'ASC' : 'DESC', ascending ? 'NULLS LAST' : 'NULLS FIRST');
  else builder.addOrderBy(column, ascending ? 'ASC' : 'DESC');
}

function propertyOf(properties: Readonly<Record<string, string>>, field: string): string {
  return Object.hasOwn(properties, field) ? (properties[field] ?? field) : field;
}
