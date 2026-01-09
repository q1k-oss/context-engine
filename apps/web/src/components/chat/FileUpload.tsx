'use client';

import { useCallback, useState } from 'react';
import { Upload, File, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import clsx from 'clsx';

interface UploadedFile {
  id: string;
  name: string;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
}

interface FileUploadProps {
  sessionId: string;
  onFileReady?: (fileId: string) => void;
}

export function FileUpload({ sessionId, onFileReady }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const droppedFiles = Array.from(e.dataTransfer.files);
      await uploadFiles(droppedFiles);
    },
    [sessionId]
  );

  const uploadFiles = async (fileList: File[]) => {
    for (const file of fileList) {
      const tempId = `temp-${Date.now()}-${file.name}`;

      setFiles((prev) => [
        ...prev,
        { id: tempId, name: file.name, status: 'uploading' },
      ]);

      try {
        const result = await apiClient.uploadFile(sessionId, file);

        if (result.success && result.data.fileId) {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === tempId
                ? { ...f, id: result.data.fileId, status: 'processing' }
                : f
            )
          );

          // Poll for processing completion
          pollFileStatus(result.data.fileId, tempId);
        } else {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === tempId
                ? { ...f, status: 'error', error: result.error?.message }
                : f
            )
          );
        }
      } catch (error) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === tempId
              ? { ...f, status: 'error', error: 'Upload failed' }
              : f
          )
        );
      }
    }
  };

  const pollFileStatus = async (fileId: string, tempId: string) => {
    const maxAttempts = 30;
    let attempts = 0;

    const poll = async () => {
      try {
        const result = await apiClient.getFile(fileId);
        if (result.success && result.data) {
          const status = result.data.processingStatus;

          if (status === 'completed') {
            setFiles((prev) =>
              prev.map((f) =>
                f.id === fileId ? { ...f, status: 'completed' } : f
              )
            );
            onFileReady?.(fileId);
            return;
          } else if (status === 'failed') {
            setFiles((prev) =>
              prev.map((f) =>
                f.id === fileId
                  ? { ...f, status: 'error', error: 'Processing failed' }
                  : f
              )
            );
            return;
          }
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000);
        } else {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileId
                ? { ...f, status: 'error', error: 'Processing timeout' }
                : f
            )
          );
        }
      } catch (error) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? { ...f, status: 'error', error: 'Status check failed' }
              : f
          )
        );
      }
    };

    poll();
  };

  const removeFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={clsx(
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
          isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
        )}
      >
        <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Drag and drop files here, or click to browse
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Supports PDF, images, and documents
        </p>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              <File className="w-5 h-5 text-gray-500" />
              <span className="flex-1 text-sm truncate">{file.name}</span>

              {file.status === 'uploading' && (
                <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
              )}
              {file.status === 'processing' && (
                <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />
              )}
              {file.status === 'completed' && (
                <CheckCircle className="w-4 h-4 text-green-500" />
              )}
              {file.status === 'error' && (
                <AlertCircle className="w-4 h-4 text-red-500" />
              )}

              <button
                onClick={() => removeFile(file.id)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
