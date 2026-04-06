/**
 * Centralized error handling — Result pattern.
 * All lib/ functions return Result<T>, never throw.
 */

export class AppError {
  constructor(
    public readonly code: string,
    public readonly message: string,
    public readonly status: number = 500
  ) {}

  static notFound(resource: string): AppError {
    return new AppError('NOT_FOUND', `${resource} not found`, 404)
  }

  static unauthorized(): AppError {
    return new AppError('UNAUTHORIZED', 'Authentication required', 401)
  }

  static forbidden(): AppError {
    return new AppError('FORBIDDEN', 'Access denied', 403)
  }

  static validation(message: string): AppError {
    return new AppError('VALIDATION_ERROR', message, 400)
  }

  static internal(message: string): AppError {
    return new AppError('INTERNAL_ERROR', message, 500)
  }
}

export type Result<T, E = AppError> =
  | { success: true; data: T }
  | { success: false; error: E }

export function ok<T>(data: T): Result<T> {
  return { success: true, data }
}

export function err<T>(error: AppError): Result<T> {
  return { success: false, error }
}
