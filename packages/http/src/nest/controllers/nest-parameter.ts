/** One parameter of a method of a Nest controller, read from Nest's `@Body`, `@Query`, `@Param` or `@Headers`. */
export interface NestParameter {
  readonly index: number;
  readonly source: 'body' | 'query' | 'params' | 'headers';
  /** The name it reads, as `@Param('invoiceId')` gives it; left out, the whole part. */
  readonly key?: string;
  /** The class TypeScript recorded for it, with `emitDecoratorMetadata`. */
  readonly type: unknown;
}
