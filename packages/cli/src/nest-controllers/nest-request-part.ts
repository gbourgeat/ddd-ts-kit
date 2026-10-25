import type { NestReadType } from './nest-read-type';

/** A part of the request a parameter of a route method takes whole (`@Body() body: IssueInvoiceBody`), and its type. */
export interface NestRequestPart {
  readonly source: 'params' | 'query' | 'headers' | 'body';
  readonly type: NestReadType;
  /** Whether `request` of `@KitRoute` gives the schema of this part instead. */
  readonly declared: boolean;
}
