import { Repository } from '@ddd-ts-kit/kernel';
import type { {{aggregate.pascal}} } from '{{alias.context}}/domain/aggregates/{{aggregate.kebab}}.aggregate.js';

export abstract class {{aggregate.pascal}}Repository extends Repository<{{aggregate.pascal}}> {
  // TODO(domain): add only the lookups a use case needs, as abstract methods named in the ubiquitous language (for example `abstract findByNumber(number: InvoiceNumber): Promise<{{aggregate.pascal}} | undefined>`); queries for screens go through a read port instead.
}
