import { AuthorizedQuery, type Actor, type Page, type PageRequest } from '@ddd-ts-kit/kernel';

export interface {{name.pascal}}Item {
  readonly id: string;
  // TODO(domain): declare the rest of one line of the list exactly as the reader needs it, flat and serializable; this is a read model, not the aggregate.
}

// TODO(domain): name the fields a client may sort "{{name.words}}" by; the read port orders by one of them and then by `id`.
export type {{name.pascal}}Sort = 'id';

export type {{name.pascal}}Result = Page<{{name.pascal}}Item>;

export class {{name.pascal}}Query extends AuthorizedQuery<{{name.pascal}}Result> {
  // TODO(domain): add the criteria of "{{name.words}}" as readonly primitives after the page (a status, a period).
  constructor(
    actor: Actor,
    readonly page: PageRequest<{{name.pascal}}Sort>,
  ) {
    super(actor);
  }
}
