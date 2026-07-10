/**
 * Database Error Handling
 * Provides structured error handling for Supabase database operations
 * Requirements: 1.6
 */

/**
 * Error codes for database operations
 */
export const ERROR_CODES = {
  CONNECTION_FAILED: 'DB_001',
  QUERY_FAILED: 'DB_002',
  CONSTRAINT_VIOLATION: 'DB_003',
  RLS_VIOLATION: 'DB_004',
  TIMEOUT: 'DB_005',
  NOT_FOUND: 'DB_006',
  VALIDATION_ERROR: 'DB_007',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

/**
 * Structured database error object
 */
export interface DatabaseError {
  code: ErrorCode;
  message: string;
  details?: string;
  hint?: string;
}

/**
 * PostgrestError type from Supabase
 */
interface PostgrestError {
  code?: string;
  message: string;
  details?: string;
  hint?: string;
}

/**
 * Error mapping from Supabase/PostgreSQL error codes to user-friendly messages
 */
const errorMap: Record<string, { code: ErrorCode; message: string }> = {
  // PostgreSQL constraint violations
  '23505': { code: ERROR_CODES.CONSTRAINT_VIOLATION, message: 'This record already exists' },
  '23503': { code: ERROR_CODES.CONSTRAINT_VIOLATION, message: 'Referenced record does not exist' },
  '23502': { code: ERROR_CODES.VALIDATION_ERROR, message: 'Required field is missing' },
  '23514': { code: ERROR_CODES.VALIDATION_ERROR, message: 'Value does not meet requirements' },
  
  // RLS violations
  '42501': { code: ERROR_CODES.RLS_VIOLATION, message: 'You do not have permission to perform this action' },
  
  // Timeout errors
  'PGRST301': { code: ERROR_CODES.TIMEOUT, message: 'Request timed out. Please try again' },
  
  // Not found errors
  'PGRST116': { code: ERROR_CODES.NOT_FOUND, message: 'Record not found' },
  
  // Connection errors
  'PGRST000': { code: ERROR_CODES.CONNECTION_FAILED, message: 'Unable to connect to database' },
};

/**
 * Handle database errors and convert to structured DatabaseError
 * Maps Supabase/PostgreSQL errors to user-friendly messages
 * Requirements: 1.6
 */
export function handleDatabaseError(error: PostgrestError): DatabaseError {
  const errorCode = error.code || '';
  const mapped = errorMap[errorCode];
  
  if (mapped) {
    return {
      code: mapped.code,
      message: mapped.message,
      details: error.details,
      hint: error.hint,
    };
  }
  
  // Default error for unmapped codes
  return {
    code: ERROR_CODES.QUERY_FAILED,
    message: 'An unexpected error occurred',
    details: error.message,
    hint: error.hint,
  };
}

/**
 * Check if an error is a specific type
 */
export function isErrorCode(error: DatabaseError | null, code: ErrorCode): boolean {
  return error?.code === code;
}

/**
 * Check if error is a constraint violation
 */
export function isConstraintViolation(error: DatabaseError | null): boolean {
  return isErrorCode(error, ERROR_CODES.CONSTRAINT_VIOLATION);
}

/**
 * Check if error is an RLS violation
 */
export function isRLSViolation(error: DatabaseError | null): boolean {
  return isErrorCode(error, ERROR_CODES.RLS_VIOLATION);
}

/**
 * Check if error is a not found error
 */
export function isNotFound(error: DatabaseError | null): boolean {
  return isErrorCode(error, ERROR_CODES.NOT_FOUND);
}
