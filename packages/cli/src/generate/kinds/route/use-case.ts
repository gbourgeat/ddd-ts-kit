/** The use case a route calls, as its message file says it. */
export interface UseCase {
  readonly isQuery: boolean;
  /** Class of the command or query, and its file inside the context, without extension. */
  readonly message: string;
  readonly messageFile: string;
  readonly returnsId: boolean;
  /** The message carries its actor: the route hands over who is calling and names the security scheme. */
  readonly isProtected: boolean;
  /** The query answers one page of a list: the route reads the page from the query string. */
  readonly isList: boolean;
}
