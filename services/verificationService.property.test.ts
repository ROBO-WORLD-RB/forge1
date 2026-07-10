import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import type { VerificationDocument, DocumentType, VerificationDocStatus } from '../types/database';

/**
 * Feature: backend-services, Property Tests for Verification Service
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7
 */

// Mock Supabase module - must be hoisted
vi.mock('./supabase', () => {
  const mockFrom = vi.fn();
  return {
    supabase: {
      from: mockFrom,
    },
  };
});

// Mock monitoring service
vi.mock('./monitoringService', () => ({
  startTransaction: vi.fn(() => ({ finish: vi.fn() })),
  captureError: vi.fn(),
}));

// Import after mocking
import {
  uploadVerificationDocument,
  getVerificationStatus,
  submitForVerification,
  approveVerification,
  rejectVerification,
  getVerificationDocument,
  isValidDocumentType,
  VERIFICATION_ERROR_CODES,
} from './verificationService';
import { supabase } from './supabase';

// Arbitraries for generating test data
const userIdArbitrary = fc.uuid();
const adminIdArbitrary = fc.uuid();
const documentIdArbitrary = fc.uuid();

// Generate valid document types
const documentTypeArbitrary = fc.constantFrom<DocumentType>(
  'government_id', 'skill_certificate', 'selfie'
);

// Generate verification status
const verificationStatusArbitrary = fc.constantFrom<VerificationDocStatus>(
  'pending', 'approved', 'rejected'
);

// Generate file URLs
const fileUrlArbitrary = fc.webUrl();

// Generate rejection reasons
const rejectionReasonArbitrary = fc.string({ minLength: 1, maxLength: 500 });


// Helper to create a mock VerificationDocument
function createMockDocument(
  id: string,
  userId: string,
  docType: DocumentType,
  fileUrl: string,
  status: VerificationDocStatus = 'pending',
  reviewedBy: string | null = null,
  rejectionReason: string | null = null
): VerificationDocument {
  const now = new Date().toISOString();
  return {
    id,
    user_id: userId,
    doc_type: docType,
    file_url: fileUrl,
    status,
    reviewed_by: reviewedBy,
    reviewed_at: reviewedBy ? now : null,
    rejection_reason: rejectionReason,
    created_at: now,
  };
}

describe('Verification Service Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  /**
   * Feature: backend-services, Property 43: Verification Document Upload
   * Validates: Requirements 9.1
   * 
   * For any valid document upload with userId, docType, and fileUrl,
   * the document should be stored with status 'pending'.
   */
  describe('Property 43: Verification Document Upload', () => {
    it('for any valid upload, document is stored with pending status', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          documentTypeArbitrary,
          fileUrlArbitrary,
          async (userId, docType, fileUrl) => {
            vi.mocked(supabase.from).mockReset();

            const mockDocId = fc.sample(fc.uuid(), 1)[0];
            const expectedDoc = createMockDocument(mockDocId, userId, docType, fileUrl, 'pending');

            vi.mocked(supabase.from).mockImplementation((table: string) => {
              if (table === 'verification_documents') {
                return {
                  select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      eq: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({
                          data: null, // No existing document
                          error: null,
                        }),
                      }),
                    }),
                  }),
                  insert: vi.fn().mockReturnValue({
                    select: vi.fn().mockReturnValue({
                      single: vi.fn().mockResolvedValue({
                        data: expectedDoc,
                        error: null,
                      }),
                    }),
                  }),
                } as any;
              }
              return {} as any;
            });

            const result = await uploadVerificationDocument(userId, docType, fileUrl);

            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();

            if (result.data) {
              expect(result.data.status).toBe('pending');
              expect(result.data.user_id).toBe(userId);
              expect(result.data.doc_type).toBe(docType);
              expect(result.data.file_url).toBe(fileUrl);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('uploading same doc type updates existing document to pending', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          documentTypeArbitrary,
          fileUrlArbitrary,
          fileUrlArbitrary,
          async (userId, docType, oldFileUrl, newFileUrl) => {
            vi.mocked(supabase.from).mockReset();

            const existingDocId = fc.sample(fc.uuid(), 1)[0];
            const existingDoc = createMockDocument(existingDocId, userId, docType, oldFileUrl, 'rejected');
            const updatedDoc = createMockDocument(existingDocId, userId, docType, newFileUrl, 'pending');

            vi.mocked(supabase.from).mockImplementation((table: string) => {
              if (table === 'verification_documents') {
                return {
                  select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      eq: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({
                          data: { id: existingDocId }, // Existing document
                          error: null,
                        }),
                      }),
                    }),
                  }),
                  update: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      select: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({
                          data: updatedDoc,
                          error: null,
                        }),
                      }),
                    }),
                  }),
                } as any;
              }
              return {} as any;
            });

            const result = await uploadVerificationDocument(userId, docType, newFileUrl);

            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();

            if (result.data) {
              expect(result.data.status).toBe('pending');
              expect(result.data.file_url).toBe(newFileUrl);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Feature: backend-services, Property 44: Verification Status Query
   * Validates: Requirements 9.2
   * 
   * For any user with verification documents, getVerificationStatus should
   * return the current state of all documents.
   */
  describe('Property 44: Verification Status Query', () => {
    it('for any user with documents, returns all document statuses', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          fc.array(
            fc.record({
              docType: documentTypeArbitrary,
              status: verificationStatusArbitrary,
            }),
            { minLength: 1, maxLength: 3 }
          ),
          async (userId, docSpecs) => {
            vi.mocked(supabase.from).mockReset();

            const mockDocs = docSpecs.map((spec, i) =>
              createMockDocument(
                fc.sample(fc.uuid(), 1)[0],
                userId,
                spec.docType,
                `https://example.com/doc${i}.pdf`,
                spec.status
              )
            );

            vi.mocked(supabase.from).mockImplementation((table: string) => {
              if (table === 'verification_documents') {
                return {
                  select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      order: vi.fn().mockResolvedValue({
                        data: mockDocs,
                        error: null,
                      }),
                    }),
                  }),
                } as any;
              }
              if (table === 'worker_profiles') {
                return {
                  select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: { verified: false },
                        error: null,
                      }),
                    }),
                  }),
                } as any;
              }
              return {} as any;
            });

            const result = await getVerificationStatus(userId);

            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();

            if (result.data) {
              expect(result.data.userId).toBe(userId);
              expect(result.data.documents.length).toBe(mockDocs.length);
              
              // All documents should be returned
              for (const doc of mockDocs) {
                const found = result.data.documents.find(d => d.id === doc.id);
                expect(found).toBeDefined();
                expect(found?.status).toBe(doc.status);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('returns none status when user has no documents', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          async (userId) => {
            vi.mocked(supabase.from).mockReset();

            vi.mocked(supabase.from).mockImplementation((table: string) => {
              if (table === 'verification_documents') {
                return {
                  select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      order: vi.fn().mockResolvedValue({
                        data: [],
                        error: null,
                      }),
                    }),
                  }),
                } as any;
              }
              if (table === 'worker_profiles') {
                return {
                  select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: { verified: false },
                        error: null,
                      }),
                    }),
                  }),
                } as any;
              }
              return {} as any;
            });

            const result = await getVerificationStatus(userId);

            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();

            if (result.data) {
              expect(result.data.overallStatus).toBe('none');
              expect(result.data.documents.length).toBe(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('overall status is approved when all documents are approved', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          fc.integer({ min: 1, max: 3 }),
          async (userId, docCount) => {
            vi.mocked(supabase.from).mockReset();

            const mockDocs = Array.from({ length: docCount }, (_, i) =>
              createMockDocument(
                fc.sample(fc.uuid(), 1)[0],
                userId,
                fc.sample(documentTypeArbitrary, 1)[0],
                `https://example.com/doc${i}.pdf`,
                'approved'
              )
            );

            vi.mocked(supabase.from).mockImplementation((table: string) => {
              if (table === 'verification_documents') {
                return {
                  select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      order: vi.fn().mockResolvedValue({
                        data: mockDocs,
                        error: null,
                      }),
                    }),
                  }),
                } as any;
              }
              if (table === 'worker_profiles') {
                return {
                  select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: { verified: true },
                        error: null,
                      }),
                    }),
                  }),
                } as any;
              }
              return {} as any;
            });

            const result = await getVerificationStatus(userId);

            expect(result.error).toBeNull();
            expect(result.data?.overallStatus).toBe('approved');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('overall status is rejected when any document is rejected', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          async (userId) => {
            vi.mocked(supabase.from).mockReset();

            const mockDocs = [
              createMockDocument(fc.sample(fc.uuid(), 1)[0], userId, 'government_id', 'https://example.com/id.pdf', 'approved'),
              createMockDocument(fc.sample(fc.uuid(), 1)[0], userId, 'selfie', 'https://example.com/selfie.pdf', 'rejected'),
            ];

            vi.mocked(supabase.from).mockImplementation((table: string) => {
              if (table === 'verification_documents') {
                return {
                  select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      order: vi.fn().mockResolvedValue({
                        data: mockDocs,
                        error: null,
                      }),
                    }),
                  }),
                } as any;
              }
              if (table === 'worker_profiles') {
                return {
                  select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: { verified: false },
                        error: null,
                      }),
                    }),
                  }),
                } as any;
              }
              return {} as any;
            });

            const result = await getVerificationStatus(userId);

            expect(result.error).toBeNull();
            expect(result.data?.overallStatus).toBe('rejected');
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Feature: backend-services, Property 45: Verification Submission Sets Pending
   * Validates: Requirements 9.3
   * 
   * For any user with uploaded documents, submitForVerification should
   * set all document statuses to 'pending'.
   */
  describe('Property 45: Verification Submission Sets Pending', () => {
    it('for any user with documents, submission sets all to pending', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          fc.array(verificationStatusArbitrary, { minLength: 1, maxLength: 3 }),
          async (userId, statuses) => {
            vi.mocked(supabase.from).mockReset();

            const mockDocs = statuses.map((status, i) => ({
              id: fc.sample(fc.uuid(), 1)[0],
              status,
            }));

            let updateCalled = false;
            let updateData: any = null;

            vi.mocked(supabase.from).mockImplementation((table: string) => {
              if (table === 'verification_documents') {
                return {
                  select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({
                      data: mockDocs,
                      error: null,
                    }),
                  }),
                  update: vi.fn().mockImplementation((data) => {
                    updateCalled = true;
                    updateData = data;
                    return {
                      eq: vi.fn().mockResolvedValue({
                        error: null,
                      }),
                    };
                  }),
                } as any;
              }
              return {} as any;
            });

            const result = await submitForVerification(userId);

            expect(result.error).toBeNull();
            expect(updateCalled).toBe(true);
            expect(updateData?.status).toBe('pending');
            expect(updateData?.reviewed_by).toBeNull();
            expect(updateData?.reviewed_at).toBeNull();
            expect(updateData?.rejection_reason).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('returns error when user has no documents', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          async (userId) => {
            vi.mocked(supabase.from).mockReset();

            vi.mocked(supabase.from).mockImplementation((table: string) => {
              if (table === 'verification_documents') {
                return {
                  select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({
                      data: [],
                      error: null,
                    }),
                  }),
                } as any;
              }
              return {} as any;
            });

            const result = await submitForVerification(userId);

            expect(result.data).toBeNull();
            expect(result.error).not.toBeNull();
            expect(result.error?.code).toBe(VERIFICATION_ERROR_CODES.NO_DOCUMENTS);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: backend-services, Property 46: Verification Approval Sets Approved and Verified
   * Validates: Requirements 9.4
   * 
   * For any pending verification, approveVerification should set document
   * status to 'approved' and worker verified flag to true.
   */
  describe('Property 46: Verification Approval Sets Approved and Verified', () => {
    it('for any pending verification, approval sets approved status and verified flag', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          adminIdArbitrary,
          fc.integer({ min: 1, max: 3 }),
          async (userId, adminId, docCount) => {
            vi.mocked(supabase.from).mockReset();

            const mockDocs = Array.from({ length: docCount }, () => ({
              id: fc.sample(fc.uuid(), 1)[0],
              status: 'pending' as VerificationDocStatus,
            }));

            let docUpdateData: any = null;
            let profileUpdateData: any = null;

            vi.mocked(supabase.from).mockImplementation((table: string) => {
              if (table === 'verification_documents') {
                return {
                  select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({
                      data: mockDocs,
                      error: null,
                    }),
                  }),
                  update: vi.fn().mockImplementation((data) => {
                    docUpdateData = data;
                    return {
                      eq: vi.fn().mockResolvedValue({
                        error: null,
                      }),
                    };
                  }),
                } as any;
              }
              if (table === 'worker_profiles') {
                return {
                  update: vi.fn().mockImplementation((data) => {
                    profileUpdateData = data;
                    return {
                      eq: vi.fn().mockResolvedValue({
                        error: null,
                      }),
                    };
                  }),
                } as any;
              }
              return {} as any;
            });

            const result = await approveVerification(userId, adminId);

            expect(result.error).toBeNull();
            expect(docUpdateData?.status).toBe('approved');
            expect(docUpdateData?.reviewed_by).toBe(adminId);
            expect(docUpdateData?.reviewed_at).toBeDefined();
            expect(docUpdateData?.rejection_reason).toBeNull();
            expect(profileUpdateData?.verified).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('returns error when user has no documents', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          adminIdArbitrary,
          async (userId, adminId) => {
            vi.mocked(supabase.from).mockReset();

            vi.mocked(supabase.from).mockImplementation((table: string) => {
              if (table === 'verification_documents') {
                return {
                  select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({
                      data: [],
                      error: null,
                    }),
                  }),
                } as any;
              }
              return {} as any;
            });

            const result = await approveVerification(userId, adminId);

            expect(result.data).toBeNull();
            expect(result.error).not.toBeNull();
            expect(result.error?.code).toBe(VERIFICATION_ERROR_CODES.NO_DOCUMENTS);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Feature: backend-services, Property 47: Verification Rejection Sets Rejected with Reason
   * Validates: Requirements 9.5
   * 
   * For any pending verification, rejectVerification should set document
   * status to 'rejected' with the provided reason and reviewer information.
   */
  describe('Property 47: Verification Rejection Sets Rejected with Reason', () => {
    it('for any pending verification, rejection sets rejected status with reason', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          adminIdArbitrary,
          rejectionReasonArbitrary,
          fc.integer({ min: 1, max: 3 }),
          async (userId, adminId, reason, docCount) => {
            vi.mocked(supabase.from).mockReset();

            const mockDocs = Array.from({ length: docCount }, () => ({
              id: fc.sample(fc.uuid(), 1)[0],
              status: 'pending' as VerificationDocStatus,
            }));

            let docUpdateData: any = null;
            let profileUpdateData: any = null;

            vi.mocked(supabase.from).mockImplementation((table: string) => {
              if (table === 'verification_documents') {
                return {
                  select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({
                      data: mockDocs,
                      error: null,
                    }),
                  }),
                  update: vi.fn().mockImplementation((data) => {
                    docUpdateData = data;
                    return {
                      eq: vi.fn().mockResolvedValue({
                        error: null,
                      }),
                    };
                  }),
                } as any;
              }
              if (table === 'worker_profiles') {
                return {
                  update: vi.fn().mockImplementation((data) => {
                    profileUpdateData = data;
                    return {
                      eq: vi.fn().mockResolvedValue({
                        error: null,
                      }),
                    };
                  }),
                } as any;
              }
              return {} as any;
            });

            const result = await rejectVerification(userId, adminId, reason);

            expect(result.error).toBeNull();
            expect(docUpdateData?.status).toBe('rejected');
            expect(docUpdateData?.reviewed_by).toBe(adminId);
            expect(docUpdateData?.reviewed_at).toBeDefined();
            expect(docUpdateData?.rejection_reason).toBe(reason);
            expect(profileUpdateData?.verified).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('returns error when user has no documents', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          adminIdArbitrary,
          rejectionReasonArbitrary,
          async (userId, adminId, reason) => {
            vi.mocked(supabase.from).mockReset();

            vi.mocked(supabase.from).mockImplementation((table: string) => {
              if (table === 'verification_documents') {
                return {
                  select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({
                      data: [],
                      error: null,
                    }),
                  }),
                } as any;
              }
              return {} as any;
            });

            const result = await rejectVerification(userId, adminId, reason);

            expect(result.data).toBeNull();
            expect(result.error).not.toBeNull();
            expect(result.error?.code).toBe(VERIFICATION_ERROR_CODES.NO_DOCUMENTS);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: backend-services, Property 48: Verification Document Round-Trip Persistence
   * Validates: Requirements 9.6, 9.7
   * 
   * For any valid verification document data, after uploading and retrieving,
   * the document should contain all original data.
   */
  describe('Property 48: Verification Document Round-Trip Persistence', () => {
    it('for any valid document, upload then retrieve returns equivalent data', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          documentTypeArbitrary,
          fileUrlArbitrary,
          async (userId, docType, fileUrl) => {
            vi.mocked(supabase.from).mockReset();

            const mockDocId = fc.sample(fc.uuid(), 1)[0];
            const storedDoc = createMockDocument(mockDocId, userId, docType, fileUrl, 'pending');

            let insertCallCount = 0;

            vi.mocked(supabase.from).mockImplementation((table: string) => {
              if (table === 'verification_documents') {
                return {
                  select: vi.fn().mockImplementation((fields) => {
                    // Check if this is a single document query or existence check
                    if (fields === '*') {
                      return {
                        eq: vi.fn().mockReturnValue({
                          single: vi.fn().mockResolvedValue({
                            data: storedDoc,
                            error: null,
                          }),
                          eq: vi.fn().mockReturnValue({
                            maybeSingle: vi.fn().mockResolvedValue({
                              data: null, // No existing document
                              error: null,
                            }),
                          }),
                        }),
                      };
                    }
                    return {
                      eq: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                          maybeSingle: vi.fn().mockResolvedValue({
                            data: null,
                            error: null,
                          }),
                        }),
                      }),
                    };
                  }),
                  insert: vi.fn().mockReturnValue({
                    select: vi.fn().mockReturnValue({
                      single: vi.fn().mockResolvedValue({
                        data: storedDoc,
                        error: null,
                      }),
                    }),
                  }),
                } as any;
              }
              return {} as any;
            });

            // Upload document
            const uploadResult = await uploadVerificationDocument(userId, docType, fileUrl);
            expect(uploadResult.error).toBeNull();
            expect(uploadResult.data).not.toBeNull();

            // Reset mock for retrieval
            vi.mocked(supabase.from).mockImplementation((table: string) => {
              if (table === 'verification_documents') {
                return {
                  select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      single: vi.fn().mockResolvedValue({
                        data: storedDoc,
                        error: null,
                      }),
                    }),
                  }),
                } as any;
              }
              return {} as any;
            });

            // Retrieve document
            const retrieveResult = await getVerificationDocument(mockDocId);
            expect(retrieveResult.error).toBeNull();
            expect(retrieveResult.data).not.toBeNull();

            // Verify round-trip consistency
            if (uploadResult.data && retrieveResult.data) {
              expect(retrieveResult.data.user_id).toBe(userId);
              expect(retrieveResult.data.doc_type).toBe(docType);
              expect(retrieveResult.data.file_url).toBe(fileUrl);
              expect(retrieveResult.data.status).toBe('pending');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('document type validation works correctly', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (docType) => {
            const isValid = isValidDocumentType(docType);
            const expectedValid = ['government_id', 'skill_certificate', 'selfie'].includes(docType);
            return isValid === expectedValid;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
