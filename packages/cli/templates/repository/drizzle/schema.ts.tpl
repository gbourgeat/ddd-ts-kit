import { integer, text, timestamp } from 'drizzle-orm/pg-core';
import { contextSchema } from '@ddd-ts-kit/drizzle/postgres';

export const {{context.camel}}Schema = contextSchema('{{context.kebab}}');

// ddd-ts-kit:tables
// /ddd-ts-kit:tables
