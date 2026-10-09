import { {{access.queryBase}} } from '@ddd-ts-kit/kernel';

export interface {{name.pascal}}Result {
  // TODO(domain): declare the answer exactly as the reader needs it, flat and serializable; this is a read model, not the aggregate.
}

export class {{name.pascal}}Query extends {{access.queryBase}}<{{name.pascal}}Result> {
  // TODO(domain): declare the criteria of "{{name.words}}" as a constructor with readonly primitives (filters, page), for example `{{access.constructorSample}}`.
}
