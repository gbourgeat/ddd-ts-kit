/** The class a schema validates with, when it names one; else what the controller writes. */
export function schemaClassOf(source: string, written: string): string {
  const page = /^pageSchemaOf\((.+)\)$/.exec(written)?.[1];

  if (page !== undefined) {
    return `page of ${schemaClassOf(source, page)}`;
  }

  const inline = /^classSchema\((\w+)/.exec(written)?.[1];

  return inline ?? new RegExp(String.raw`\bconst ${written} = classSchema\((\w+)`).exec(source)?.[1] ?? written;
}
