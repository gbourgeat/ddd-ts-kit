import { CONFIG_FILE, editConfigText, type Deviation } from '../../config';
import type { Workspace } from '../../workspace';
import type { Kind } from '../kind';
import { writeAdr } from './write-adr';

export const adrKind: Kind = {
  name: 'adr',
  aliases: [],
  usage: 'adr "<title>" [--number <n>] [--deviation <what>] [--reason "<why>"]',
  summary:
    'A decision record in docs/adr/, numbered after the highest or by --number; with --deviation, the entry of the config that points to it.',
  positionals: ['title'],
  writesShared: true,
  writesInModules: false,
  run: ({ ws, args, flags }) => {
    const title = (args[0] ?? '').trim();
    const { deviation: what, reason = title, number: asked } = flags;

    const number = writeAdr(ws, {
      title,
      ...(asked === undefined ? {} : { number: asked }),
      ...(what === undefined ? {} : { deviation: { what, reason } }),
    });

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
