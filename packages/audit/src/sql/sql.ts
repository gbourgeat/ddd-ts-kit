/** A statement as its literal parts and the values that go between them, in order. */
export class Sql {
  constructor(
    readonly strings: readonly string[],
    readonly values: readonly unknown[],
  ) {}
}

/** `sql\`select ${value}\``: a value becomes a parameter, a nested `Sql` is spliced in. */
export function sql(strings: TemplateStringsArray, ...parts: readonly unknown[]): Sql {
  return parts.reduce<Sql>(
    (statement, part, index) => {
      const following = text(strings[index + 1] ?? '');

      return part instanceof Sql ? concat(concat(statement, part), following) : withValue(statement, part, following);
    },
    text(strings[0] ?? ''),
  );
}

function text(literal: string): Sql {
  return new Sql([literal], []);
}

function concat(left: Sql, right: Sql): Sql {
  const joint = `${left.strings.at(-1) ?? ''}${right.strings[0] ?? ''}`;

  return new Sql([...left.strings.slice(0, -1), joint, ...right.strings.slice(1)], [...left.values, ...right.values]);
}

function withValue(statement: Sql, value: unknown, following: Sql): Sql {
  return concat(new Sql([...statement.strings, ''], [...statement.values, value]), following);
}

/** A quoted identifier, or a qualified one: `identifier('audit', 'audit_entries')`. */
export function identifier(...names: readonly string[]): Sql {
  return text(names.map((name) => `"${name.replaceAll('"', '""')}"`).join('.'));
}

export function joined(parts: readonly Sql[], separator: string): Sql {
  const [first, ...rest] = parts;

  return rest.reduce((all, part) => concat(concat(all, text(separator)), part), first ?? text(''));
}
