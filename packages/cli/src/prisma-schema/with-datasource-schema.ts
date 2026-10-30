import { datasourceSchemas } from './datasource-schemas';

/** The main schema file with this database schema last in its datasource, unless it lists it. */
export function withDatasourceSchema(text: string, schema: string): string {
  if (datasourceSchemas(text).includes(schema)) {
    return text;
  }

  return text.replace(/(schemas\s*=\s*\[[^\]]*)\]/, (_list, listed: string) => `${listed}, "${schema}"]`);
}
