import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { DATABASE_URL } from '$env/static/private';
import * as schema from './schema';

// --- Drizzle singleton (one connection per server instance) ---
const client = postgres(DATABASE_URL, { max: 10 });

export const db = drizzle(client, { schema });
