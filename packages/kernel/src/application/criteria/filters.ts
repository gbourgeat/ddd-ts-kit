import type { FieldOf } from './field-of.js';
import type { FilterNode, FilterOperand } from './filter-node.js';
import type { FilterOperator } from './filter-operator.js';
import type { OperandOf } from './operand-of.js';
import type { OperatorOf } from './operator-of.js';

/** The filters of one group, built fluently and never changed: every method answers a new list. */
export class Filters<Row> {
  static none<Row>(): Filters<Row> {
    return new Filters<Row>([]);
  }

  private constructor(readonly nodes: readonly FilterNode[]) {}

  where<Field extends FieldOf<Row> & keyof Row, Operator extends OperatorOf<Row[Field]>>(
    field: Field,
    operator: Operator,
    value: OperandOf<Row[Field], Operator> & FilterOperand,
  ): Filters<Row>;
  where(field: string, operator: FilterOperator, value: FilterOperand): Filters<Row> {
    return this.plus({ kind: 'condition', field, operator, value });
  }

  and(build: (filters: Filters<Row>) => Filters<Row>): Filters<Row> {
    return this.plus({ kind: 'and', filters: build(Filters.none<Row>()).nodes });
  }

  or(build: (filters: Filters<Row>) => Filters<Row>): Filters<Row> {
    return this.plus({ kind: 'or', filters: build(Filters.none<Row>()).nodes });
  }

  not(build: (filters: Filters<Row>) => Filters<Row>): Filters<Row> {
    return this.plus({ kind: 'not', filters: build(Filters.none<Row>()).nodes });
  }

  /** A filter written as data, whose names the compiler did not check: validate before use. */
  plus(node: FilterNode): Filters<Row> {
    return new Filters<Row>([...this.nodes, node]);
  }
}
