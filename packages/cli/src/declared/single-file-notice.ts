import { barrelFile } from './barrel-file';

/** What a finding, a note or a warning says of a context that `keepsSingleFile`. */
export interface SingleFileNotice {
  readonly message: string;
  readonly fix: string;
}

/** What `check`, `docs --check` and `generate --local-only` say of a context that `keepsSingleFile`. */
export function singleFileNotice(context: string): SingleFileNotice {
  return {
    message: `"${context}" still keeps all its declarations in ${barrelFile(context)}, the single file the generator wrote up to 0.84: it is current, so this version accepts it, and a later minor version reports it as an error.`,
    fix: `Run \`npx ddd-ts-kit docs\` (or any \`generate\`, or \`npm run dev\`), which writes the <folder>.declarations.ts of each role folder and rewrites ${barrelFile(context)} as their summary, and commit the result.`,
  };
}
