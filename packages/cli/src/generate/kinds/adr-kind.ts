import { CONFIG_FILE, editConfigText, type Deviation } from '../../config/index.js';
import type { Workspace } from '../../workspace/index.js';
import type { Kind } from '../kind.js';
import { writeAdr } from './write-adr.js';

export const adrKind: Kind = {
  name: 'adr',
  aliases: [],
  usage: 'adr "<title>" [--deviation <what>] [--reason "<why>"]',
  summary: 'A decision record in docs/adr/; with --deviation, the entry of the config that points to it.',
  positionals: ['title'],
  writesShared: true,
  run: ({ ws, args, flags }) => {
    const title = (args[0] ?? '').trim();
    const { deviation: what, reason = title } = flags;
    const number = writeAdr(ws, { title, ...(what === undefined ? {} : { deviation: { what, reason } }) });

    if (what !== undefined) {
      declareDeviation(ws, { what, adr: number, reason });
    }
  },
};

function declareDeviation(ws: Workspace, deviation: Deviation): void {
  const text = ws.read(CONFIG_FILE);

  if (text === undefined) {
    return;
  }

  ws.update(
    CONFIG_FILE,
    editConfigText(text, (raw) => {
      const present: unknown[] = Array.isArray(raw['deviations']) ? raw['deviations'] : [];

      raw['deviations'] = [...present, deviation];
    }),
  );
}
