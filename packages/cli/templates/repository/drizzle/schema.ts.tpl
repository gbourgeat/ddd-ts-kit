// ddd-ts-kit:imports
import { integer, text } from 'drizzle-orm/pg-core';
import { contextSchema } from '@ddd-ts-kit/drizzle/postgres';
// /ddd-ts-kit:imports

export const {{context.camel}}Schema = contextSchema('{{context.kebab}}');

// ddd-ts-kit:tables
// /ddd-ts-kit:tables
