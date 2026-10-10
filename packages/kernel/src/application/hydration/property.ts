/** `{ [name]: value }`, typed by the literal name. */
export function property<Name extends string, Value>(name: Name, value: Value): { readonly [Key in Name]: Value };

export function property(name: string, value: unknown): Readonly<Record<string, unknown>> {
  return { [name]: value };
}
