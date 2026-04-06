import { Lucia } from 'lucia';
import { DrizzlePostgreSQLAdapter } from '@lucia-auth/adapter-drizzle';
import { db } from '$lib/server/db';
import { sessions, users } from '$lib/server/db/schema';
import { dev } from '$app/environment';

// --- Lucia adapter ---
const adapter = new DrizzlePostgreSQLAdapter(db, sessions, users);

// --- Lucia singleton ---
export const lucia = new Lucia(adapter, {
	sessionCookie: {
		attributes: {
			secure: !dev
		}
	},
	getUserAttributes: (attributes) => ({
		email: attributes.email,
		name: attributes.name
	})
});

// --- Type augmentation ---
declare module 'lucia' {
	interface Register {
		Lucia: typeof lucia;
		DatabaseUserAttributes: {
			email: string;
			name: string;
		};
	}
}
