import type { Stack } from '../config';
import type { Dialect } from './dialect';

/** `npm` and `npx` as words of their own: `pnpm run` is not `npm run`. */
const NPM = String.raw`(?<![\w@/.-])npm`;
const NPX = String.raw`(?<![\w@/.-])npx`;
const SCRIPT = String.raw`([\w:.-]+)`;

const said = (pattern: string): RegExp => new RegExp(pattern, 'g');

/** pnpm hands `--` over to the script as an argument: what follows the script name is already its arguments. */
const PNPM: Dialect = [
  [said(`${NPM} run --silent ${SCRIPT} -- `), 'pnpm --silent run $1 '],
  [said(`${NPM} run --silent `), 'pnpm --silent run '],
  [said(`${NPM} (run ${SCRIPT}|test) -- `), 'pnpm $1 '],
  [said(`${NPM} (run|test|start)(?![\\w-])`), 'pnpm $1'],
  [said(`${NPX} (?:--no -- )?`), 'pnpm exec '],
  [said(`${NPM} ci --omit=dev`), 'pnpm install --frozen-lockfile --prod'],
  [said(`${NPM} ci(?![\\w-])`), 'pnpm install --frozen-lockfile'],
  [said(`${NPM} audit --omit=dev --audit-level=high`), 'pnpm audit --prod --audit-level high'],
  [said(`${NPM} (install|publish)(?![\\w-])`), 'pnpm $1'],
  [said(String.raw`package-lock\.json`), 'pnpm-lock.yaml'],
];

/** The templates are written for npm: it has nothing to translate. */
export const DIALECTS: Readonly<Record<Stack['packageManager'], Dialect>> = { npm: [], pnpm: PNPM };
