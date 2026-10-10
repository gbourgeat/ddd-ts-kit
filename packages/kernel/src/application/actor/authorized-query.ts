import { Query } from '../messaging/query.js';
import type { Actor } from './actor.js';
import type { Actored } from './actored.js';

/** A question that somebody must be allowed to ask. */
export abstract class AuthorizedQuery<R> extends Query<R> implements Actored {
  constructor(readonly actor: Actor) {
    super();
  }
}
