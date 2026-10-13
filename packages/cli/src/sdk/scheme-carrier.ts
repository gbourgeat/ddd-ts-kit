/** Where a security scheme carries its credential: a header (with the prefix of an HTTP scheme), a query parameter or a cookie. */
export interface SchemeCarrier {
  readonly in: 'header' | 'query' | 'cookie';
  readonly name: string;
  readonly prefix: string;
}
