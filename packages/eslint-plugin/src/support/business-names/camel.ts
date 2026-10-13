/** `practiceMember` for `PracticeMember`: the name of a binding that holds one of them. */
export function camel(pascal: string): string {
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}
