import { describe, expect, it } from 'vitest';
import { declaredShape } from '../src/check/event-sourcing/declared-shape';
import { readStoredShape } from '../src/check/event-sourcing/read-stored-shape';
import { scan } from '../src/check/scan/scan';

const shapeOf = (data: string) => readStoredShape(scan(`export interface Data { ${data} }\n`), 'Data');

describe('the stored shape of a type that holds type arguments', () => {
  it('keeps a member whole across the commas of its type arguments, an arrow inside them included', () => {
    const file = scan(
      'export interface Data {\n  a: Map<string, (at: number) => Side>;\n  b: Record<\n    string,\n    number\n  >;\n}\n',
    );

    expect(declaredShape(file, 'Data')?.members).toEqual([
      'a:Map<string,(at:number)=>Side>',
      'b:Record<string,number>',
    ]);
  });

  it('gives two shapes that differ only inside their type arguments two fingerprints', () => {
    const before = shapeOf('a: Record<string, number>; b: Record<number, string>;');
    const after = shapeOf('a: Record<string, string>; b: Record<number, number>;');

    expect(before?.fingerprint).not.toBe(after?.fingerprint);
    expect(before?.formerFingerprint).toBe(after?.formerFingerprint);
  });

  it('knows the fingerprint 0.82.0 gave a type it split, and none for a type it read as it reads now', () => {
    const plain = shapeOf('cents: number; label: string;');
    const generic = shapeOf('totals: Record<string, number>;');

    expect(plain?.formerFingerprint).toBeUndefined();
    expect(generic?.formerFingerprint).toMatch(/^sha256:[0-9a-f]{16}$/);
    expect(generic?.formerFingerprint).not.toBe(generic?.fingerprint);
  });

  it('reads an alias of one generic type up to its semicolon, as one member', () => {
    const file = scan('export type Totals = Record<string, number>;\n');

    expect(declaredShape(file, 'Totals')?.members).toEqual(['Record<string,number>']);
  });
});
