import { cli, read } from '../helpers';
import { expectOk } from './expect-ok';
import { initProject } from './init-project';

export const INDEX = 'src/platform/database/schema.ts';

export const CONTEXTS = [
  '--context',
  'billing:core',
  '--context',
  'shipping:supporting',
  '--context',
  'returns:supporting',
];

/** The tables file of a context. */
export function tablesOf(context: string): string {
  return `src/contexts/${context}/infrastructure/persistence/${context}.schema.ts`;
}

/** What the schema index imports the tables file of a context by. */
export function sourceOf(context: string): string {
  return `@/contexts/${context}/infrastructure/persistence/${context}.schema`;
}

/** The aggregate Parcel of a context, with its repository. */
export function storeParcel(root: string, context: string): void {
  expectOk(cli(root, 'generate', 'aggregate', context, 'Parcel', '--term', 'Parcel=What is sent to a customer'));
  expectOk(cli(root, 'generate', 'repository', context, 'Parcel'));
}

/** The aggregate Job of a context, with its repository: its table bears the name of the background jobs of the platform. */
export function storeJob(root: string, context: string): void {
  expectOk(cli(root, 'generate', 'aggregate', context, 'Job', '--term', 'Job=A piece of work billed to a customer'));
  expectOk(cli(root, 'generate', 'repository', context, 'Job'));
}

/** The read model InvoiceSummaries of a context, and its aggregate Parcel with its repository. */
export function storeBoth(root: string, context: string): void {
  expectOk(cli(root, 'generate', 'read-model', context, 'InvoiceSummaries', '--field', 'weight:number'));
  storeParcel(root, context);
}

/** A project on an ORM whose contexts billing and shipping each store a read model and an aggregate of the same names. */
export function twoContextsOn(orm: string): string {
  const root = initProject('--orm', orm, ...CONTEXTS);

  storeBoth(root, 'billing');
  storeBoth(root, 'shipping');

  return root;
}

/** The lines a region of the index of a project holds. */
export function regionOf(root: string, region: string): string[] {
  return regionIn(read(root, INDEX), region);
}

/** The lines a region of a text holds. */
export function regionIn(text: string, region: string): string[] {
  const held = new RegExp(`// ddd-ts-kit:${region}\\n([\\s\\S]*?)[ \\t]*// /ddd-ts-kit:${region}\\n`).exec(text);

  return (held?.[1] ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

/** A text whose region holds nothing any more. */
export function emptied(text: string, region: string): string {
  return text.replace(
    new RegExp(`(// ddd-ts-kit:${region}\\n)[\\s\\S]*?([ \\t]*// /ddd-ts-kit:${region}\\n)`),
    (_found, open: string, close: string) => `${open}${close}`,
  );
}

/** The index of `twoContextsOn('drizzle')`: each name settled between billing, which held it first, and shipping. */
export const SETTLED_ON_DRIZZLE = [
  `export * from '${sourceOf('billing')}';`,
  `export * from '${sourceOf('shipping')}';`,
  `export { invoiceSummaries } from '${sourceOf('billing')}';`,
  `export { invoiceSummaries as shippingInvoiceSummaries } from '${sourceOf('shipping')}';`,
  `export { parcels } from '${sourceOf('billing')}';`,
  `export { parcels as shippingParcels } from '${sourceOf('shipping')}';`,
];
