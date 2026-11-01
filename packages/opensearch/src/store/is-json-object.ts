/** Whether a value of an answer is a JSON object, which a document and its members are. */
export function isJsonObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
