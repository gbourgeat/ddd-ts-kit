import { Query } from '../messaging/query';
import type { Actor } from './actor';
import type { Actored } from './actored';

/** A question that somebody must be allowed to ask. */
export abstract class AuthorizedQuery<R> extends Query<R> implements Actored {
  constructor(readonly actor: Actor) {
    super();
  }
}
