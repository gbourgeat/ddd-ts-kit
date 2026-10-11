import { specifierOf } from '../../alias/index.js';
import type { Scope } from '../scope.js';

/** Exports a file of a published language from its index, once. */
export function publishInIndex({ ws, config }: Pick<Scope, 'ws' | 'config'>, directory: string, file: string): void {
  const index = `${directory}/index.ts`;
  const line = `export * from '${specifierOf(config, `${directory}/${file}.ts`)}';`;

  const lines = (ws.read(index) ?? '')
    .split('\n')
    .filter((existing) => existing.trim() !== '' && existing.trim() !== 'export {};');

  if (lines.includes(line)) {
    return;
  }

  const content = `${[...lines, line].join('\n')}\n`;

  if (ws.exists(index)) {
    ws.update(index, content);
  } else {
    ws.create(index, content);
  }
}
