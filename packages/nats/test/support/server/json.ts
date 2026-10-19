/** A JSON object of a request or a configuration, read field by field. */
export type Json = Readonly<Record<string, unknown>>;

export function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The body of an API request: `{}` when it is empty or not an object. */
export function bodyOf(data: Buffer): Json {
  const text = data.toString('utf8').trim();

  if (text === '') {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(text);

    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function numberIn(body: Json, key: string): number | undefined {
  const value = body[key];

  return typeof value === 'number' ? value : undefined;
}

export function stringIn(body: Json, key: string): string | undefined {
  const value = body[key];

  return typeof value === 'string' ? value : undefined;
}

export function recordIn(body: Json, key: string): Json {
  const value = body[key];

  return isRecord(value) ? value : {};
}

/** Two configurations are the same when their JSON is, keys in any order. */
export function sameJson(left: Json, right: Json): boolean {
  return canonical(left) === canonical(right);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(',')}]`;
  }

  if (isRecord(value)) {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`);

    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value);
}

/** A duration of the JetStream API, in nanoseconds, as milliseconds. */
export function millisecondsOf(nanoseconds: number | undefined, fallback: number): number {
  return nanoseconds === undefined ? fallback : Math.round(nanoseconds / 1_000_000);
}
