import { z } from 'zod';

export const {{name.camel}}Schema = z
  .object({
    // TODO(domain): declare the fields of "{{name.words}}" as a client sees them, with shape constraints only (types, formats, lengths). A route uses the schema whole (`zodSchema({{name.camel}}Schema)`), inside another one, or in part (`.pick`, `.omit`, `.partial`, `.extend`); the contract documents it once, as {{name.pascal}}.
  })
  .meta({ id: '{{name.pascal}}' });
