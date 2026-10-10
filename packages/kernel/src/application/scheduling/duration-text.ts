/** A whole number followed by a unit: `'500ms'`, `'30s'`, `'15m'`, `'2h'`, `'1d'`. */
export type DurationText = `${number}${'ms' | 's' | 'm' | 'h' | 'd'}`;
