import { barrelFile } from './barrel-file';

/** A layout of the declarations an earlier version of the generator wrote, read so that `docs` moves it. */
export type EarlierLayout = 'single-file' | 'role-folders';

/** What a finding, a note or a warning says of a context that keeps an earlier layout. */
export interface EarlierLayoutNotice {
  readonly message: string;
  readonly fix: string;
}

/** What `check`, `docs --check` and `generate --local-only` say of a context that keeps an earlier layout (`earlierLayoutOf`). */
export function earlierLayoutNotice(context: string, layout: EarlierLayout): EarlierLayoutNotice {
  const kept =
    layout === 'single-file'
      ? `still keeps all its declarations in ${barrelFile(context)}, the single file the generator wrote up to 0.84`
      : 'still keeps its declarations in one file per role folder (application/commands/commands.declarations.ts), as the generator wrote them in 0.85 and 0.86';

  return {
    message: `"${context}" ${kept}: a context declares its role files in the <layer>.declarations.ts of each layer now.`,
    fix: `Run \`npx ddd-ts-kit docs\` (or any \`generate\`, or \`npm run dev\`), which writes the <layer>.declarations.ts of each layer${layout === 'role-folders' ? ', deletes those of the role folders' : ''} and rewrites ${barrelFile(context)} as their summary, and commit the result.`,
  };
}
