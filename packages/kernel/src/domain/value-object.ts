/**
 * Immutable, compared by value, valid at construction. Subclass with a private
 * constructor and a `create` factory that validates and returns a Result or throws.
 */
export abstract class ValueObject<Props extends Record<string, unknown>> {
  protected readonly props: Readonly<Props>;

  protected constructor(props: Props) {
    this.props = Object.freeze({ ...props });
  }

  equals(other: ValueObject<Props> | undefined | null): boolean {
    if (other === undefined || other === null || other.constructor !== this.constructor) {
      return false;
    }

    return structurallyEqual(this.props, other.props);
  }

  toJSON(): Props {
    return this.props;
  }
}

function structurallyEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;

  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();

  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => structurallyEqual(item, b[i]));
  }

  if (isRecord(a) && isRecord(b)) {
    const keys = Object.keys(a);

    return (
      keys.length === Object.keys(b).length &&
      keys.every((key) => key in b && structurallyEqual(a[key], b[key]))
    );
  }

  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
