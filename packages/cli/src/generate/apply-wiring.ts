import { insertInRegion, parseWiring } from '../markers/index.js';
import type { Workspace } from '../workspace/index.js';

/** Applies a rendered wiring template to a file with marker regions. */
export function applyWiring(ws: Workspace, file: string, wiring: string): void {
  const original = ws.read(file);

  if (original === undefined) {
    ws.note(`${file} does not exist: wire the new element by hand.`);

    return;
  }

  let content = original;

  for (const [region, block] of parseWiring(ws.spoken(wiring))) {
    if (block.trim() === '') {
      continue;
    }

    const next = insertInRegion(content, region, block);

    if (next === undefined) {
      ws.note(`${file} has no "ddd-ts-kit:${region}" region: add this by hand:\n${block.trimEnd()}`);
    } else {
      content = next;
    }
  }

  ws.update(file, content);
}
