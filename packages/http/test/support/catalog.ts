import { z } from 'zod';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { defineRoute, money, pageSchemaOf, streamSchemaOf, type Route } from '../../src/index.js';

/** A closed vocabulary, written as its code in every representation. */
export const ProductStatus = { onSale: 'on-sale', withdrawn: 'withdrawn' } as const;

const productSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.string(),
  currency: z.string(),
  status: z.enum([ProductStatus.onSale, ProductStatus.withdrawn]),
  releasedAt: z.string(),
  stock: z.number().int().nullable(),
});

export type Product = z.infer<typeof productSchema>;

const product = zodSchema(productSchema, { io: 'output' });

const newProduct = zodSchema(
  z.strictObject({ name: z.string().min(1), price: z.string(), quantities: z.array(z.number().int()).optional() }),
);

const released = new Date(Date.UTC(2026, 2, 1, 8, 30));

/** Two products, the second one with a name a spreadsheet would run and a stock nobody counted. */
export const PRODUCTS: readonly Product[] = [
  {
    id: '1',
    name: 'Kettle, "steel"',
    ...priced('12.30'),
    status: 'on-sale',
    releasedAt: released.toISOString(),
    stock: 4,
  },
  {
    id: '2',
    name: '=SUM(A1)',
    ...priced('0.99'),
    status: 'withdrawn',
    releasedAt: released.toISOString(),
    stock: null,
  },
];

export const catalogRoutes: readonly Route[] = [
  defineRoute(
    {
      method: 'GET',
      path: '/products',
      operationId: 'searchProducts',
      summary: 'Search products',
      responses: { 200: { description: 'A page.', body: pageSchemaOf(product) } },
      security: false,
      produces: ['application/xml', 'text/csv'],
    },
    () => ({ status: 200, body: { items: Array.from(PRODUCTS), total: PRODUCTS.length } }),
  ),
  defineRoute(
    {
      method: 'GET',
      path: '/products/export',
      operationId: 'exportProducts',
      summary: 'Export products',
      responses: { 200: { description: 'Every product.', body: streamSchemaOf(product) } },
      security: false,
      produces: ['text/csv', 'application/xml'],
    },
    () => ({ status: 200, body: rows(PRODUCTS) }),
  ),
  defineRoute(
    {
      method: 'POST',
      path: '/products',
      operationId: 'addProduct',
      summary: 'Add a product',
      request: { body: newProduct },
      responses: { 201: { description: 'Added.', body: product } },
      security: false,
      produces: ['application/xml'],
      consumes: ['application/xml'],
    },
    ({ body }) => ({
      status: 201,
      body: {
        id: String(body.quantities?.length ?? 0),
        name: body.name,
        ...priced(body.price),
        status: 'on-sale',
        releasedAt: released.toISOString(),
        stock: null,
      },
    }),
  ),
];

function priced(amount: string): Pick<Product, 'price' | 'currency'> {
  const { amount: price, currency } = money(amount, 'EUR');

  return { price, currency };
}

async function* rows(products: readonly Product[]): AsyncIterable<Product> {
  for (const row of products) {
    await Promise.resolve();
    yield row;
  }
}
