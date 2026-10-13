/** Strings a YAML reader takes for something else when they are written plain. */
export const MISREAD = [
  'yes',
  'no',
  'on',
  'off',
  'y',
  'N',
  'null',
  '~',
  'true',
  'False',
  '1',
  '-2',
  '1.5',
  '.5',
  '0x1f',
];

export const AWKWARD = [
  ...MISREAD,
  ...['1e3', '.inf', '.NaN', '2026-10-12', '1:20', '<<', '=', '@scope', '*alias', '&anchor', '!tag', '%directive'],
  ...['a: b', 'a #b', 'ends:', '', ' lead', 'trail ', "it's", '"quoted"', '-', '- item', '? key', '{a}', '[a]'],
  ...['|', '>', '#', '`', 'a\tb', 'a\u0001b', 'a\u2028b', 'é ü 中', 'https://example.com/a?b=c#d', 'x-error-codes'],
];

export const TEXTS = {
  clipped: 'line one\nline two\n',
  stripped: 'a\nb',
  kept: 'a\n\n',
  indentedFirst: '  indented\nnext\n',
  blankInside: 'a\n\nb\n',
  newlineOnly: '\n',
  carriageReturn: 'a\r\nb',
  hashFirst: '# not a comment\nx',
};

export const SHAPES = {
  empty: {},
  none: [],
  nested: [[1, 2], [], {}, { a: [{ b: 'c\nd' }] }],
  numbers: [0, -1, 3.25, 1e21],
  flags: [true, false, null],
  '200': { description: 'OK' },
  '/calendars/{calendarId}': { get: { $ref: '#/components/schemas/Problem' } },
  'application/problem+json': {},
};
