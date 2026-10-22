import type { CriteriaDefinition } from '../../application/criteria/criteria-definition';
import { TableReadModelStore } from '../read-model/table-read-model-store';
import { InMemoryReadModelTable } from './in-memory-read-model-table';

/**
 * The fake of any read model port: `new InMemoryReadModelStore(appointmentCriteria)`. It
 * filters, sorts and pages with the reference semantics of criteria, and applies events
 * exactly as a database adapter does.
 */
export class InMemoryReadModelStore<Row extends object> extends TableReadModelStore<Row> {
  constructor(definition: CriteriaDefinition<Row>) {
    super(new InMemoryReadModelTable<Row>(), definition);
  }
}
