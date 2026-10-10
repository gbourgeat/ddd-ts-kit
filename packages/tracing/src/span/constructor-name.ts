/** Read without trusting the type: an object created without prototype has no constructor. */
export function constructorName(value: object): unknown {
  const constructor: unknown = Reflect.get(value, 'constructor');

  const named =
    (typeof constructor === 'object' || typeof constructor === 'function') &&
    constructor !== null &&
    'name' in constructor;

  return named ? constructor.name : undefined;
}
