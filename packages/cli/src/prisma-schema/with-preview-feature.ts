/** The generator of the client with `feature` among its preview features, its assignments kept aligned. */
export function withPreviewFeature(schema: string, feature: string): string {
  const body = /^generator client \{\n([\s\S]*?)^\}$/m.exec(schema)?.[1];

  return body === undefined ? schema : schema.replace(body, generatorWith(body, feature));
}

function generatorWith(body: string, feature: string): string {
  const listed = /^(\s*previewFeatures\s*=\s*\[)([^\]]*)\]/m.exec(body);

  if (listed === null) {
    const column = /^(\s*\w+\s*)=/m.exec(body)?.[1]?.length ?? 0;

    return `${body}${'  previewFeatures'.padEnd(column)}= ["${feature}"]\n`;
  }

  const [assignment, opening = '', features = ''] = listed;

  if (features.includes(`"${feature}"`)) {
    return body;
  }

  const all = [features.trim(), `"${feature}"`].filter((one) => one !== '');

  return body.replace(assignment, `${opening}${all.join(', ')}]`);
}
