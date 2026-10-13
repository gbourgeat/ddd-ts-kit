import Type from 'typebox';

export const {{name.camel}}Schema = Type.Object(
  {
    // TODO(domain): declare the fields of "{{name.words}}" as a client sees them, with shape constraints only (types, formats, lengths). A route uses the schema whole (`typeboxSchema({{name.camel}}Schema)`), inside another one, or in part (`Type.Pick`, `Type.Omit`, `Type.Partial`, `Type.Composite`); the contract documents it once, as {{name.pascal}}.
  },
  { $id: '{{name.pascal}}' },
);
