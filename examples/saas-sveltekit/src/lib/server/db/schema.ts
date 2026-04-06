import { pgTable, text, integer, timestamp, uuid, jsonb } from 'drizzle-orm/pg-core';

// --- Users table ---
export const users = pgTable('users', {
	id: uuid('id').primaryKey().defaultRandom(),
	email: text('email').notNull().unique(),
	name: text('name').notNull(),
	hashed_password: text('hashed_password').notNull(),
	stripe_customer_id: text('stripe_customer_id'),
	created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

// --- Invoices table ---
export const invoices = pgTable('invoices', {
	id: uuid('id').primaryKey().defaultRandom(),
	user_id: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	client_name: text('client_name').notNull(),
	client_email: text('client_email').notNull(),
	status: text('status', { enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'] })
		.default('draft')
		.notNull(),
	due_date: text('due_date').notNull(),
	total_cents: integer('total_cents').notNull().default(0),
	stripe_payment_link: text('stripe_payment_link'),
	notes: text('notes'),
	created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

// --- Line items table ---
export const lineItems = pgTable('line_items', {
	id: uuid('id').primaryKey().defaultRandom(),
	invoice_id: uuid('invoice_id')
		.notNull()
		.references(() => invoices.id, { onDelete: 'cascade' }),
	description: text('description').notNull(),
	quantity: integer('quantity').notNull(),
	unit_price: integer('unit_price').notNull(),
	created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

// --- Sessions table (Lucia) ---
export const sessions = pgTable('sessions', {
	id: text('id').primaryKey(),
	user_id: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expires_at: timestamp('expires_at', { withTimezone: true }).notNull()
});
