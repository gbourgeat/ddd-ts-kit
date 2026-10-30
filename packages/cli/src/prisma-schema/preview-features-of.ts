/** The preview features the generator of the client of a main schema file turns on. */
export function previewFeaturesOf(schema: string): string[] {
  const generator = /^generator client \{\n([\s\S]*?)^\}$/m.exec(schema)?.[1] ?? '';
  const listed = /^\s*previewFeatures\s*=\s*\[([^\]]*)\]/m.exec(generator)?.[1] ?? '';

  return [...listed.matchAll(/"([^"]+)"/g)].map(([, feature = '']) => feature);
}
