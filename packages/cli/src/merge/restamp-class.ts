import fs from 'node:fs';
import { scan } from '../check/scan/scan';

const STAMPED_CLASS = /(?<![\w$.])class\s+([A-Za-z_$][\w$]*?)(\d{13})(?![\w$])/;
const NAME_PROPERTY = /(?<![\w$.])name\s*(?::[^=;{}]*)?=\s*$/;

/**
 * TypeORM knows a migration by its class, whose name ends with the 13 digits it orders by, and
 * repeats that name in `name`: the class of the file takes `stamp`, wherever the code names it
 * (its declaration, an `export default`, an `export { ... }`) and in the value of its `name`
 * property. A comment, a statement of SQL and a longer identifier that hold the same letters are
 * left as they are.
 */
export function restampClass(file: string, stamp: string): void {
  const text = fs.readFileSync(file, 'utf8');
  const { code, strings } = scan(text);
  // The file is a migration because it declares such a class: `migrationsOfTree` reads it the same way.
  const [, base = '', old = ''] = STAMPED_CLASS.exec(code) ?? [];
  const named = `${base}${old}`;
  const renamed = `${base.replace(/^Working(?=[A-Z])/, '')}${stamp}`;
  const tokens = [...code.matchAll(new RegExp(String.raw`(?<![\w$])${named}(?![\w$])`, 'g'))].map(({ index }) => index);

  const values = strings
    .filter(({ value, start }) => value === named && NAME_PROPERTY.test(code.slice(0, start)))
    .map(({ start }) => text.indexOf(named, start));

  fs.writeFileSync(file, replacedAt(text, [...tokens, ...values], { named, renamed }));
}

function replacedAt(
  text: string,
  offsets: readonly number[],
  { named, renamed }: { named: string; renamed: string },
): string {
  return [...offsets]
    .sort((left, right) => right - left)
    .reduce((written, at) => `${written.slice(0, at)}${renamed}${written.slice(at + named.length)}`, text);
}
