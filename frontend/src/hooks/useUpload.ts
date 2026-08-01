/**
 * useUpload — hooks for /api/v1/upload/pdf
 * Supports multipart/form-data + upload progress tracking via XMLHttpRequest.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getErrorMessage } from '../lib/api';

export interface UploadProgressEvent {
  loaded: number;
  total: number;
  percent: number;
}

export interface PDFUploadResult {
  file_name: string;
  saved_filename: string;
  file_size_bytes: number;
  metadata?: { title?: string; author?: string; pages?: number };
  pages?: unknown[];
  tables?: unknown[];
}

interface UploadPDFOptions {
  onProgress?: (evt: UploadProgressEvent) => void;
}

const BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

/** Upload one or more PDFs via XMLHttpRequest to track progress */
async function uploadPDFWithProgress(
  files: File[],
  token: string | null,
  options?: UploadPDFOptions,
): Promise<PDFUploadResult | PDFUploadResult[]> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    for (const f of files) formData.append('files', f);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE}/upload/pdf`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && options?.onProgress) {
        options.onProgress({
          loaded: e.loaded,
          total: e.total,
          percent: Math.round((e.loaded / e.total) * 100),
        });
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const parsed = JSON.parse(xhr.responseText);
          resolve(parsed.data);
        } catch {
          reject(new Error('Failed to parse upload response'));
        }
      } else {
        try {
          const parsed = JSON.parse(xhr.responseText);
          reject(new Error(parsed.message || parsed.detail || `HTTP ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed: HTTP ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => reject(new Error('Network error during file upload'));
    xhr.ontimeout = () => reject(new Error('Upload request timed out'));
    xhr.send(formData);
  });
}

/** Mutation hook for PDF upload */
export function useUploadPDF(options?: UploadPDFOptions) {
  const qc = useQueryClient();
  const token = localStorage.getItem('access_token');

  return useMutation({
    mutationFn: (files: File[]) => uploadPDFWithProgress(files, token, options),
    onSuccess: () => {
      // Invalidate graph + stats so dashboard/graph refreshes after upload
      qc.invalidateQueries({ queryKey: ['graph'] });
    },
    onError: (err) => console.error('Upload error:', getErrorMessage(err)),
  });
}
