import { identifier, type Sql } from './statement.js';

export function qualified(schema: string | undefined, name: string): Sql {
  return schema === undefined ? identifier(name) : identifier(schema, name);
}
