/** The names as given, a name already taken followed by a number: `list`, `list2`. */
export function uniqueNames(names: readonly string[]): string[] {
  const taken = new Set<string>();

  return names.map((name) => {
    let unique = name;

    for (let attempt = 2; taken.has(unique); attempt += 1) {
      unique = `${name}${attempt}`;
    }

    taken.add(unique);

    return unique;
  });
}
