// --- AppError + Result<T> (R4 — never throw in lib/) ---

export class AppError {
	constructor(
		public code: string,
		public message: string,
		public status: number = 500
	) {}
}

export type Result<T, E = AppError> =
	| { success: true; data: T }
	| { success: false; error: E };

export function ok<T>(data: T): Result<T> {
	return { success: true, data };
}

export function err<E = AppError>(error: E): Result<never, E> {
	return { success: false, error };
}

// --- Common errors ---
export const Errors = {
	unauthorized: () => new AppError('UNAUTHORIZED', 'Authentication required', 401),
	notFound: (resource: string) => new AppError('NOT_FOUND', `${resource} not found`, 404),
	forbidden: () => new AppError('FORBIDDEN', 'Access denied', 403),
	validation: (message: string) => new AppError('VALIDATION', message, 400),
	internal: (message: string) => new AppError('INTERNAL', message, 500),
	stripe: (message: string) => new AppError('STRIPE_ERROR', message, 502)
} as const;
