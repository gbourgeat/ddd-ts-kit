import type { PageRequest } from '../pagination/page-request.js';
import type { SortDirection } from '../pagination/sort-direction.js';
import type { Sort } from '../pagination/sort.js';
import type { FieldOf } from './field-of.js';
import type { FilterNode, FilterOperand } from './filter-node.js';
import type { FilterOperator } from './filter-operator.js';
import { Filters } from './filters.js';
import type { OperandOf } from './operand-of.js';
import type { OperatorOf } from './operator-of.js';

interface State<Row> {
  readonly filters: Filters<Row>;
  readonly sort: readonly Sort[];
  readonly page?: PageRequest;
}

export interface CriteriaParts {
  readonly filters?: readonly FilterNode[];
  readonly sort?: readonly Sort[];
  readonly page?: PageRequest;
}

/**
 * The description of one read of a read model: filters joined by AND, a sort and a page. It
 * knows field names and nothing of a store: a read port declares what it accepts with a
 * `CriteriaDefinition`, and a translator of the store turns the two into a query. Immutable:
 * every method answers a new criteria.
 */
export class Criteria<Row> {
  static of<Row>(): Criteria<Row> {
    return new Criteria<Row>({ filters: Filters.none<Row>(), sort: [] });
  }

  /** From data the compiler did not check, a parsed query string for instance: validate it before use. */
  static from<Row>(parts: CriteriaParts): Criteria<Row> {
    const filters = (parts.filters ?? []).reduce((all, node) => all.plus(node), Filters.none<Row>());

    return new Criteria<Row>({ filters, sort: parts.sort ?? [], ...(parts.page === undefined ? {} : { page: parts.page }) });
  }

  private constructor(private readonly state: State<Row>) {}

  get filters(): readonly FilterNode[] {
    return this.state.filters.nodes;
  }

  /** The `orderBy` calls first, then the sort of the page request for the fields not ordered yet. */
  get sort(): readonly Sort[] {
    const ordered = this.state.sort;
    const asked = this.state.page?.sort ?? [];

    return [...ordered, ...asked.filter(({ field }) => !ordered.some((sort) => sort.field === field))];
  }

  get pageRequest(): PageRequest | undefined {
    return this.state.page;
  }

  where<Field extends FieldOf<Row> & keyof Row, Operator extends OperatorOf<Row[Field]>>(
    field: Field,
    operator: Operator,
    value: OperandOf<Row[Field], Operator> & FilterOperand,
  ): Criteria<Row>;
  where(field: string, operator: FilterOperator, value: FilterOperand): Criteria<Row> {
    return this.filtered(this.state.filters.plus({ kind: 'condition', field, operator, value }));
  }

  and(build: (filters: Filters<Row>) => Filters<Row>): Criteria<Row> {
    return this.filtered(this.state.filters.and(build));
  }

  or(build: (filters: Filters<Row>) => Filters<Row>): Criteria<Row> {
    return this.filtered(this.state.filters.or(build));
  }

  not(build: (filters: Filters<Row>) => Filters<Row>): Criteria<Row> {
    return this.filtered(this.state.filters.not(build));
  }

  orderBy(field: FieldOf<Row>, direction: SortDirection = 'asc'): Criteria<Row> {
    return new Criteria<Row>({ ...this.state, sort: [...this.state.sort, { field, direction }] });
  }

  page(request: PageRequest): Criteria<Row> {
    return new Criteria<Row>({ ...this.state, page: request });
  }

  private filtered(filters: Filters<Row>): Criteria<Row> {
    return new Criteria<Row>({ ...this.state, filters });
  }
}
