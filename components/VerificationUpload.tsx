import React, { useState, useEffect, useRef } from 'react';
import { getVerificationStatus, uploadVerificationDocument } from '../services/verificationService';
import type { DocumentType, VerificationDocument, VerificationDocStatus } from '../types/database';
import { Loader2, Upload, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { uploadPrivateFile } from '../utils/storageUpload';
import { withTimeout } from '../utils/promiseTimeout';

const DOC_TYPES: { type: DocumentType; label: string; hint: string }[] = [
  { type: 'government_id', label: 'Government ID', hint: 'Ghana Card, NIN, or passport' },
  { type: 'skill_certificate', label: 'Skill Certificate', hint: 'Trade certificate or qualification' },
  { type: 'selfie', label: 'Selfie', hint: 'Clear photo of your face' },
];

const STATUS_STYLES: Record<VerificationDocStatus | 'none', { icon: React.ReactNode; label: string; className: string }> = {
  none: { icon: <Clock className="w-4 h-4" />, label: 'Not uploaded', className: 'text-gray-500 bg-gray-50' },
  pending: { icon: <Clock className="w-4 h-4" />, label: 'Pending review', className: 'text-yellow-700 bg-yellow-50' },
  approved: { icon: <CheckCircle className="w-4 h-4" />, label: 'Approved', className: 'text-green-700 bg-green-50' },
  rejected: { icon: <XCircle className="w-4 h-4" />, label: 'Rejected', className: 'text-red-700 bg-red-50' },
};

interface VerificationUploadProps {
  userId: string;
}

const VerificationUpload: React.FC<VerificationUploadProps> = ({ userId }) => {
  const [documents, setDocuments] = useState<VerificationDocument[]>([]);
  const [overallStatus, setOverallStatus] = useState<VerificationDocStatus | 'none'>('none');
  const [isVerified, setIsVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<DocumentType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<DocumentType, HTMLInputElement | null>>({
    government_id: null,
    skill_certificate: null,
    selfie: null,
  });

  const loadStatus = async () => {
    setLoading(true);
    try {
      const { data, error: statusError } = await withTimeout(
        getVerificationStatus(userId),
        20_000,
        'Loading verification status'
      );
      if (statusError) {
        setError(statusError.message);
      } else if (data) {
        setDocuments(data.documents);
        setOverallStatus(data.overallStatus);
        setIsVerified(data.isVerified);
        setError(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not load verification status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, [userId]);

  const getDocStatus = (docType: DocumentType): VerificationDocStatus | 'none' => {
    const doc = documents.find(d => d.doc_type === docType);
    return doc?.status ?? 'none';
  };

  const getDoc = (docType: DocumentType): VerificationDocument | undefined => {
    return documents.find(d => d.doc_type === docType);
  };

  const handleFileChange = async (docType: DocumentType, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError('Document must be 10MB or smaller.');
      e.target.value = '';
      return;
    }

    setUploading(docType);
    setError(null);

    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${userId}/${docType}-${Date.now()}.${fileExt}`;

      // Private bucket — store storage path; AdminDashboard creates signed URLs on view
      await uploadPrivateFile('verification-documents', fileName, file, {
        upsert: true,
        label: 'Verification document upload',
        timeoutMs: 60_000,
      });

      const { data, error: docError } = await withTimeout(
        uploadVerificationDocument(userId, docType, fileName),
        30_000,
        'Saving verification document'
      );

      if (docError) throw new Error(docError.message);
      if (data) {
        setDocuments(prev => {
          const filtered = prev.filter(d => d.doc_type !== docType);
          return [data, ...filtered];
        });
        await loadStatus();
      }
    } catch (err: any) {
      console.error('Verification upload error:', err);
      setError(
        err?.message?.includes('timed out')
          ? 'Upload timed out. Check your connection and try again.'
          : err?.message || 'Failed to upload document. Please try again.'
      );
    } finally {
      setUploading(null);
      e.target.value = '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 text-forge-orange animate-spin" />
      </div>
    );
  }

  const overallStyle = STATUS_STYLES[overallStatus];

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${overallStyle.className}`}>
        {overallStyle.icon}
        <span>
          {isVerified ? 'Verified worker' : `Verification: ${overallStyle.label}`}
        </span>
      </div>

      {DOC_TYPES.map(({ type, label, hint }) => {
        const status = getDocStatus(type);
        const style = STATUS_STYLES[status];
        const doc = getDoc(type);
        const isUploading = uploading === type;

        return (
          <div key={type} className="border border-gray-200 rounded-xl p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">{label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{hint}</p>
                <div className={`inline-flex items-center gap-1.5 mt-2 px-2 py-1 rounded text-xs font-medium ${style.className}`}>
                  {style.icon}
                  {style.label}
                </div>
                {doc?.rejection_reason && status === 'rejected' && (
                  <p className="text-xs text-red-600 mt-2">{doc.rejection_reason}</p>
                )}
              </div>
              <div>
                <input
                  ref={el => { fileInputRefs.current[type] = el; }}
                  type="file"
                  accept="image/*,.pdf"
                  onChange={e => handleFileChange(type, e)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRefs.current[type]?.click()}
                  disabled={isUploading || status === 'approved'}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {status === 'none' ? 'Upload' : 'Replace'}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default VerificationUpload;
