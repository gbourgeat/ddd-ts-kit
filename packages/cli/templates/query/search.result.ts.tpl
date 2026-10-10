import type { Page } from '@ddd-ts-kit/kernel';

export interface {{name.pascal}}Item {
  readonly id: string;
  // TODO(domain): declare the rest of one line of the search exactly as the reader needs it, flat and serializable; this is a read model, not the aggregate.
}

// TODO(domain): name the fields a client may sort "{{name.words}}" by; the read port orders by one of them and then by `id`.
export type {{name.pascal}}Sort = 'id';

export type {{name.pascal}}Result = Page<{{name.pascal}}Item>;
