export function braceDepthAt(code: string, offset: number): number {
  const before = code.slice(0, offset);

  return before.split('{').length - before.split('}').length;
}
