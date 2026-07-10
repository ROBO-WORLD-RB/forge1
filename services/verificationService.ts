/**
 * Verification Service
 * Manages worker KYC document verification for the BlueCollar marketplace
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7
 */

import { supabase } from './supabase';
import type { 
  VerificationDocument, 
  VerificationDocumentInsert, 
  DocumentType, 
  VerificationDocStatus 
} from '../types/database';
import { handleDatabaseError, DatabaseError } from './databaseErrors';
import { startTransaction, captureError } from './monitoringService';

/**
 * Extended error codes for verification operations
 */
export const VERIFICATION_ERROR_CODES = {
  DOCUMENT_NOT_FOUND: 'VER_001',
  INVALID_DOCUMENT_TYPE: 'VER_002',
  VERIFICATION_PENDING: 'VER_003',
  NO_DOCUMENTS: 'VER_004',
  ALREADY_VERIFIED: 'VER_005',
  USER_NOT_FOUND: 'VER_006',
} as const;

/**
 * Result type for verification service operations
 */
export interface VerificationServiceResult<T> {
  data: T | null;
  error: DatabaseError | null;
}

/**
 * Verification state for a user
 */
export interface VerificationState {
  userId: string;
  isVerified: boolean;
  documents: VerificationDocument[];
  overallStatus: VerificationDocStatus | 'none';
}

/**
 * Valid document types
 */
const VALID_DOCUMENT_TYPES: DocumentType[] = ['government_id', 'skill_certificate', 'selfie'];

/**
 * Validate document type
 */
export function isValidDocumentType(docType: string): docType is DocumentType {
  return VALID_DOCUMENT_TYPES.includes(docType as DocumentType);
}


/**
 * Upload a verification document
 * Stores document with type and file URL, sets status to 'pending'
 * Requirements: 9.1
 */
export async function uploadVerificationDocument(
  userId: string,
  docType: DocumentType,
  fileUrl: string
): Promise<VerificationServiceResult<VerificationDocument>> {
  const transaction = startTransaction('verification.uploadDocument', 'db');

  try {
    // Validate document type
    if (!isValidDocumentType(docType)) {
      return {
        data: null,
        error: {
          code: VERIFICATION_ERROR_CODES.INVALID_DOCUMENT_TYPE as any,
          message: `Invalid document type. Must be one of: ${VALID_DOCUMENT_TYPES.join(', ')}`,
        },
      };
    }

    // Check if document of this type already exists for user
    const { data: existingDoc, error: existingError } = await (supabase
      .from('verification_documents') as any)
      .select('id')
      .eq('user_id', userId)
      .eq('doc_type', docType)
      .maybeSingle();

    if (existingError) {
      captureError(new Error(existingError.message), { tags: { operation: 'uploadVerificationDocument' } });
      return {
        data: null,
        error: handleDatabaseError(existingError),
      };
    }

    // If document exists, update it; otherwise create new
    if (existingDoc) {
      const { data, error } = await (supabase
        .from('verification_documents') as any)
        .update({
          file_url: fileUrl,
          status: 'pending',
          reviewed_by: null,
          reviewed_at: null,
          rejection_reason: null,
        })
        .eq('id', existingDoc.id)
        .select()
        .single();

      if (error) {
        captureError(new Error(error.message), { tags: { operation: 'uploadVerificationDocument' } });
        return {
          data: null,
          error: handleDatabaseError(error),
        };
      }

      return {
        data: data as VerificationDocument,
        error: null,
      };
    }

    // Create new document
    const insertData: VerificationDocumentInsert = {
      user_id: userId,
      doc_type: docType,
      file_url: fileUrl,
      status: 'pending',
    };

    const { data, error } = await (supabase
      .from('verification_documents') as any)
      .insert(insertData)
      .select()
      .single();

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'uploadVerificationDocument' } });
      return {
        data: null,
        error: handleDatabaseError(error),
      };
    }

    return {
      data: data as VerificationDocument,
      error: null,
    };
  } finally {
    transaction.finish();
  }
}

/**
 * Get verification status for a user
 * Returns current verification state and all document statuses
 * Requirements: 9.2
 */
export async function getVerificationStatus(
  userId: string
): Promise<VerificationServiceResult<VerificationState>> {
  const transaction = startTransaction('verification.getStatus', 'db');

  try {
    // Get all verification documents for user
    const { data: documents, error: docsError } = await (supabase
      .from('verification_documents') as any)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (docsError) {
      captureError(new Error(docsError.message), { tags: { operation: 'getVerificationStatus' } });
      return {
        data: null,
        error: handleDatabaseError(docsError),
      };
    }

    const docList = (documents || []) as VerificationDocument[];

    // Get worker profile to check verified flag
    const { data: workerProfile, error: profileError } = await (supabase
      .from('worker_profiles') as any)
      .select('verified')
      .eq('user_id', userId)
      .maybeSingle();

    // Determine overall status
    let overallStatus: VerificationDocStatus | 'none' = 'none';
    
    if (docList.length > 0) {
      // If any document is rejected, overall is rejected
      if (docList.some(doc => doc.status === 'rejected')) {
        overallStatus = 'rejected';
      }
      // If all documents are approved, overall is approved
      else if (docList.every(doc => doc.status === 'approved')) {
        overallStatus = 'approved';
      }
      // Otherwise, overall is pending
      else {
        overallStatus = 'pending';
      }
    }

    return {
      data: {
        userId,
        isVerified: workerProfile?.verified ?? false,
        documents: docList,
        overallStatus,
      },
      error: null,
    };
  } finally {
    transaction.finish();
  }
}

/**
 * Submit documents for verification
 * Sets all document statuses to 'pending' for review
 * Requirements: 9.3
 */
export async function submitForVerification(
  userId: string
): Promise<VerificationServiceResult<void>> {
  const transaction = startTransaction('verification.submit', 'db');

  try {
    // Check if user has any documents
    const { data: documents, error: docsError } = await (supabase
      .from('verification_documents') as any)
      .select('id, status')
      .eq('user_id', userId);

    if (docsError) {
      captureError(new Error(docsError.message), { tags: { operation: 'submitForVerification' } });
      return {
        data: null,
        error: handleDatabaseError(docsError),
      };
    }

    const docList = (documents || []) as { id: string; status: VerificationDocStatus }[];

    if (docList.length === 0) {
      return {
        data: null,
        error: {
          code: VERIFICATION_ERROR_CODES.NO_DOCUMENTS as any,
          message: 'No documents uploaded. Please upload verification documents first.',
        },
      };
    }

    // Update all documents to pending status
    const { error: updateError } = await (supabase
      .from('verification_documents') as any)
      .update({
        status: 'pending',
        reviewed_by: null,
        reviewed_at: null,
        rejection_reason: null,
      })
      .eq('user_id', userId);

    if (updateError) {
      captureError(new Error(updateError.message), { tags: { operation: 'submitForVerification' } });
      return {
        data: null,
        error: handleDatabaseError(updateError),
      };
    }

    return {
      data: undefined,
      error: null,
    };
  } finally {
    transaction.finish();
  }
}


/**
 * Approve verification for a user
 * Sets document status to 'approved' and worker verified flag to true
 * Requirements: 9.4
 */
export async function approveVerification(
  userId: string,
  adminId: string
): Promise<VerificationServiceResult<void>> {
  const transaction = startTransaction('verification.approve', 'db');

  try {
    // Check if user has pending documents
    const { data: documents, error: docsError } = await (supabase
      .from('verification_documents') as any)
      .select('id, status')
      .eq('user_id', userId);

    if (docsError) {
      captureError(new Error(docsError.message), { tags: { operation: 'approveVerification' } });
      return {
        data: null,
        error: handleDatabaseError(docsError),
      };
    }

    const docList = (documents || []) as { id: string; status: VerificationDocStatus }[];

    if (docList.length === 0) {
      return {
        data: null,
        error: {
          code: VERIFICATION_ERROR_CODES.NO_DOCUMENTS as any,
          message: 'No documents found for this user.',
        },
      };
    }

    const now = new Date().toISOString();

    // Update all documents to approved status
    const { error: updateDocsError } = await (supabase
      .from('verification_documents') as any)
      .update({
        status: 'approved',
        reviewed_by: adminId,
        reviewed_at: now,
        rejection_reason: null,
      })
      .eq('user_id', userId);

    if (updateDocsError) {
      captureError(new Error(updateDocsError.message), { tags: { operation: 'approveVerification' } });
      return {
        data: null,
        error: handleDatabaseError(updateDocsError),
      };
    }

    // Update worker profile verified flag to true
    const { error: updateProfileError } = await (supabase
      .from('worker_profiles') as any)
      .update({ verified: true })
      .eq('user_id', userId);

    if (updateProfileError) {
      captureError(new Error(updateProfileError.message), { tags: { operation: 'approveVerification' } });
      return {
        data: null,
        error: handleDatabaseError(updateProfileError),
      };
    }

    return {
      data: undefined,
      error: null,
    };
  } finally {
    transaction.finish();
  }
}

/**
 * Reject verification for a user
 * Sets document status to 'rejected' with reason and reviewer information
 * Requirements: 9.5
 */
export async function rejectVerification(
  userId: string,
  adminId: string,
  reason: string
): Promise<VerificationServiceResult<void>> {
  const transaction = startTransaction('verification.reject', 'db');

  try {
    // Check if user has documents
    const { data: documents, error: docsError } = await (supabase
      .from('verification_documents') as any)
      .select('id, status')
      .eq('user_id', userId);

    if (docsError) {
      captureError(new Error(docsError.message), { tags: { operation: 'rejectVerification' } });
      return {
        data: null,
        error: handleDatabaseError(docsError),
      };
    }

    const docList = (documents || []) as { id: string; status: VerificationDocStatus }[];

    if (docList.length === 0) {
      return {
        data: null,
        error: {
          code: VERIFICATION_ERROR_CODES.NO_DOCUMENTS as any,
          message: 'No documents found for this user.',
        },
      };
    }

    const now = new Date().toISOString();

    // Update all documents to rejected status with reason
    const { error: updateDocsError } = await (supabase
      .from('verification_documents') as any)
      .update({
        status: 'rejected',
        reviewed_by: adminId,
        reviewed_at: now,
        rejection_reason: reason,
      })
      .eq('user_id', userId);

    if (updateDocsError) {
      captureError(new Error(updateDocsError.message), { tags: { operation: 'rejectVerification' } });
      return {
        data: null,
        error: handleDatabaseError(updateDocsError),
      };
    }

    // Ensure worker profile verified flag is false
    const { error: updateProfileError } = await (supabase
      .from('worker_profiles') as any)
      .update({ verified: false })
      .eq('user_id', userId);

    if (updateProfileError) {
      // Log but don't fail - the main operation succeeded
      captureError(new Error(updateProfileError.message), { tags: { operation: 'rejectVerification' } });
    }

    return {
      data: undefined,
      error: null,
    };
  } finally {
    transaction.finish();
  }
}

/**
 * Get a single verification document by ID
 */
export async function getVerificationDocument(
  documentId: string
): Promise<VerificationServiceResult<VerificationDocument>> {
  const { data, error } = await (supabase
    .from('verification_documents') as any)
    .select('*')
    .eq('id', documentId)
    .single();

  if (error) {
    return {
      data: null,
      error: handleDatabaseError(error),
    };
  }

  return {
    data: data as VerificationDocument,
    error: null,
  };
}

/**
 * Get all verification documents for a user
 */
export async function getVerificationDocuments(
  userId: string
): Promise<VerificationServiceResult<VerificationDocument[]>> {
  const { data, error } = await (supabase
    .from('verification_documents') as any)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    return {
      data: null,
      error: handleDatabaseError(error),
    };
  }

  return {
    data: (data || []) as VerificationDocument[],
    error: null,
  };
}

/**
 * Verification Service interface
 */
export interface VerificationService {
  uploadVerificationDocument(userId: string, docType: DocumentType, fileUrl: string): Promise<VerificationServiceResult<VerificationDocument>>;
  getVerificationStatus(userId: string): Promise<VerificationServiceResult<VerificationState>>;
  submitForVerification(userId: string): Promise<VerificationServiceResult<void>>;
  approveVerification(userId: string, adminId: string): Promise<VerificationServiceResult<void>>;
  rejectVerification(userId: string, adminId: string, reason: string): Promise<VerificationServiceResult<void>>;
  getVerificationDocument(documentId: string): Promise<VerificationServiceResult<VerificationDocument>>;
  getVerificationDocuments(userId: string): Promise<VerificationServiceResult<VerificationDocument[]>>;
  isValidDocumentType(docType: string): docType is DocumentType;
}

// Export as a service object for compatibility with existing code patterns
export const verificationService: VerificationService = {
  uploadVerificationDocument,
  getVerificationStatus,
  submitForVerification,
  approveVerification,
  rejectVerification,
  getVerificationDocument,
  getVerificationDocuments,
  isValidDocumentType,
};

export default verificationService;
