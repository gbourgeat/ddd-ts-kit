const IRREGULAR: Readonly<Record<string, string>> = {
  paid: 'pay',
  sent: 'send',
  sold: 'sell',
  bought: 'buy',
  made: 'make',
  lost: 'lose',
  written: 'write',
  given: 'give',
  taken: 'take',
  withdrawn: 'withdraw',
  held: 'hold',
  kept: 'keep',
  left: 'leave',
  found: 'find',
  built: 'build',
  spent: 'spend',
  chosen: 'choose',
  begun: 'begin',
  done: 'do',
  gone: 'go',
  known: 'know',
  shown: 'show',
  frozen: 'freeze',
  broken: 'break',
  met: 'meet',
  told: 'tell',
  brought: 'bring',
  children: 'child',
  people: 'person',
};

/** Crude English inflection: every base form a word may come from, the word itself included. */
export function baseForms(word: string): Set<string> {
  const lower = word.toLowerCase();
  const irregular = IRREGULAR[lower];

  return new Set([lower, ...(irregular === undefined ? [] : [irregular]), ...singulars(lower), ...infinitives(lower)]);
}

function singulars(lower: string): string[] {
  const forms: string[] = [];

  if (lower.endsWith('ies')) forms.push(`${lower.slice(0, -3)}y`);
  if (lower.endsWith('es')) forms.push(lower.slice(0, -2));
  if (lower.endsWith('s') && !lower.endsWith('ss')) forms.push(lower.slice(0, -1));

  return forms;
}

function infinitives(lower: string): string[] {
  const forms: string[] = [];

  if (lower.endsWith('ied')) forms.push(`${lower.slice(0, -3)}y`);

  for (const suffix of ['ed', 'ing']) {
    if (!lower.endsWith(suffix) || lower.length <= suffix.length + 2) continue;

    const stem = lower.slice(0, -suffix.length);

    forms.push(stem, `${stem}e`, undouble(stem));
  }

  if (lower.endsWith('d')) forms.push(lower.slice(0, -1));

  return forms;
}

function undouble(stem: string): string {
  return /([b-df-hj-np-tv-z])\1$/.test(stem) ? stem.slice(0, -1) : stem;
}
