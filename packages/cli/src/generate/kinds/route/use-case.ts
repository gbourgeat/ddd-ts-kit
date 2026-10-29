import type { MessageField } from './message-fields-of';

/** The use case a route calls, as its message file says it. */
export interface UseCase {
  readonly isQuery: boolean;
  /** Class of the command or query, and its file inside the context, without extension. */
  readonly message: string;
  readonly messageFile: string;
  readonly returnsId: boolean;
  /** The message carries its actor: the route hands over who is calling and names the security scheme. */
  readonly isProtected: boolean;
  /** The query answers one page of a search: the route reads the page from the query string. */
  readonly isSearch: boolean;
  /** The fields its constructor declares past the actor, in order: what the route reads from the request. */
  readonly fields: readonly MessageField[];
}
