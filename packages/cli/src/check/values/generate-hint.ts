import type { SourceFile } from '../model/source-file.js';

/** The command that writes a value object where the file is: in its context, or by hand in the shared kernel. */
export function generateHint(file: SourceFile, name = '<Name>'): string {
  const { location } = file;

  return location.area === 'context'
    ? `\`npx ddd-ts-kit generate value-object ${location.context} ${name}\` writes one`
    : '`npx ddd-ts-kit generate value-object <context> <Name>` writes one in a context, the model to follow here';
}
