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

/** Crude English inflection: enough to see that `Issued`, `Issuing` and `Issues` say `Issue`. */
export function sameWord(left: string, right: string): boolean {
  const forms = baseForms(left);

  return [...baseForms(right)].some((form) => forms.has(form));
}

function baseForms(word: string): Set<string> {
  const lower = word.toLowerCase();
  const forms = new Set([lower]);
  const irregular = IRREGULAR[lower];

  if (irregular !== undefined) {
    forms.add(irregular);
  }

  if (lower.endsWith('ies')) {
    forms.add(`${lower.slice(0, -3)}y`);
  }

  if (lower.endsWith('es')) {
    forms.add(lower.slice(0, -2));
  }

  if (lower.endsWith('s') && !lower.endsWith('ss')) {
    forms.add(lower.slice(0, -1));
  }

  if (lower.endsWith('ied')) {
    forms.add(`${lower.slice(0, -3)}y`);
  }

  for (const stem of verbStems(lower)) {
    forms.add(stem);
  }

  if (lower.endsWith('d')) {
    forms.add(lower.slice(0, -1));
  }

  return forms;
}

function verbStems(lower: string): string[] {
  return ['ed', 'ing']
    .filter((suffix) => lower.endsWith(suffix) && lower.length > suffix.length + 2)
    .flatMap((suffix) => {
      const stem = lower.slice(0, -suffix.length);

      return [stem, `${stem}e`, undouble(stem)];
    });
}

function undouble(stem: string): string {
  return /([b-df-hj-np-tv-z])\1$/.test(stem) ? stem.slice(0, -1) : stem;
}
