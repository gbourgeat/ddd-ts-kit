export type RenderValue = string | number | boolean | RenderContext;

/** The variables a template reads, by dotted path: `{{name.pascal}}`, `{{#if orm.knex}}`. */
export interface RenderContext {
  readonly [key: string]: RenderValue;
}
