const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** A property name as a type literal writes it: bare when it is an identifier, quoted otherwise (`'filter[day]'`). */
export function propertyKey(name: string): string {
  return IDENTIFIER.test(name) ? name : `'${name.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}
