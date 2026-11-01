import { bodyOf, type Body } from './body-of';

/** The mapping of a field, as the fake reads it. */
export interface FakeProperty {
  readonly type?: string;
  readonly enabled?: boolean;
  readonly properties?: Readonly<Record<string, FakeProperty>>;
}

/** The properties of a mapping as a request wrote them, each field read for what the fake checks. */
export function propertiesOf(value: unknown): Readonly<Record<string, FakeProperty>> {
  return Object.fromEntries(
    Object.entries(bodyOf(value)).map(([name, written]) => [name, propertyOf(bodyOf(written))]),
  );
}

function propertyOf({ type, enabled, properties }: Body): FakeProperty {
  return {
    ...(typeof type === 'string' ? { type } : {}),
    ...(typeof enabled === 'boolean' ? { enabled } : {}),
    ...(properties === undefined ? {} : { properties: propertiesOf(properties) }),
  };
}
