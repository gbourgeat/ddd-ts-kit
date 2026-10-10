import type { Workspace } from '../../workspace/index.js';

/** Exports a file of a published language from its index, once. */
export function publishInIndex(ws: Workspace, directory: string, file: string): void {
  const index = `${directory}/index.ts`;
  const line = `export * from './${file}.js';`;
  const lines = (ws.read(index) ?? '').split('\n').filter((existing) => existing.trim() !== '' && existing.trim() !== 'export {};');

  if (lines.includes(line)) return;

  const content = `${[...lines, line].join('\n')}\n`;

  if (ws.exists(index)) ws.update(index, content);
  else ws.create(index, content);
}
