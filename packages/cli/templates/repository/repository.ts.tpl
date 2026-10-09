import type { Repository } from '@ddd-ts-kit/kernel';
import type { {{aggregate.pascal}} } from '../aggregates/{{aggregate.kebab}}.aggregate.js';

export interface {{aggregate.pascal}}Repository extends Repository<{{aggregate.pascal}}> {
  // TODO(domain): add only the lookups a use case needs, named in the ubiquitous language (for example `findByNumber(number: InvoiceNumber)`); queries for screens go through a read port instead.
}
