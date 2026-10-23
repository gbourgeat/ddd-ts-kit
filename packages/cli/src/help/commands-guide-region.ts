import { referenceText } from './reference-text';

/** The generated part of docs/guides/commands.md, between its markers: the reference, as `--help` prints it. */
export function commandsGuideRegion(): string[] {
  return [
    '<!-- Generated from the help of the CLI: `npm run build`, then `node pipeline/monorepo/commands-guide.mjs`. -->',
    '',
    '```text',
    ...referenceText().split('\n'),
    '```',
  ];
}
