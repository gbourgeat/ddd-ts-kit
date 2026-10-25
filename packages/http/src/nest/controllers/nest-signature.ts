import type { Schema } from '@ddd-ts-kit/validation';
import type { DtoType } from './dto-type';

/**
 * What the signature of a route method says, as `ddd-ts-kit` reads it from its source: the DTO
 * class of each part of the request a parameter takes whole (`@Body() body: IssueInvoiceBody`), and
 * what it answers (`Promise<IssuedInvoice>`), `null` when it answers nothing.
 */
export interface NestSignature {
  readonly params?: DtoType;
  readonly query?: DtoType;
  readonly headers?: DtoType;
  readonly body?: DtoType;
  readonly answer?: Schema<unknown> | DtoType | null;
}
