'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { uploadPaper } from '@/lib/api';
import clsx from 'clsx';

interface UploadFile {
  file: File;
  title: string;
  authors: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
  documentId?: string;
}

interface PaperUploadProps {
  onUploadComplete?: () => void;
}

export default function PaperUpload({ onUploadComplete }: PaperUploadProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (file) => file.type === 'application/pdf'
    );

    addFiles(droppedFiles);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        const selectedFiles = Array.from(e.target.files);
        addFiles(selectedFiles);
      }
    },
    []
  );

  const addFiles = (newFiles: File[]) => {
    const uploadFiles: UploadFile[] = newFiles.map((file) => ({
      file,
      title: file.name.replace('.pdf', ''),
      authors: '',
      status: 'pending',
      progress: 0,
    }));

    setFiles((prev) => [...prev, ...uploadFiles]);
  };

  const updateFile = (index: number, updates: Partial<UploadFile>) => {
    setFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...updates } : f))
    );
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUploadFile = async (index: number) => {
    const fileToUpload = files[index];
    if (fileToUpload.status !== 'pending') return;

    updateFile(index, { status: 'uploading', progress: 10 });

    try {
      const result = await uploadPaper(
        fileToUpload.file,
        fileToUpload.title,
        fileToUpload.authors,
        (progress) => updateFile(index, { progress })
      );

      updateFile(index, {
        status: 'success',
        progress: 100,
        documentId: result.document_id,
      });

      onUploadComplete?.();
    } catch (error) {
      updateFile(index, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Upload failed',
      });
    }
  };

  const uploadAll = async () => {
    const pendingIndices = files
      .map((f, i) => (f.status === 'pending' ? i : -1))
      .filter((i) => i !== -1);

    for (const index of pendingIndices) {
      await handleUploadFile(index);
    }
  };

  const pendingCount = files.filter((f) => f.status === 'pending').length;
  const hasFiles = files.length > 0;

  return (
    <div className="space-y-6">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={clsx(
          'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200',
          isDragging
            ? 'border-[var(--color-forest)] bg-[var(--color-forest)]/5'
            : 'border-[var(--color-sand)] hover:border-[var(--color-forest)] hover:bg-[var(--color-parchment)]/50'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="w-16 h-16 rounded-full bg-[var(--color-parchment)] flex items-center justify-center mx-auto mb-4">
          <Upload
            size={28}
            className={clsx(
              'transition-colors',
              isDragging
                ? 'text-[var(--color-forest)]'
                : 'text-[var(--color-stone)]'
            )}
          />
        </div>

        <p className="font-medium text-[var(--color-ink)] mb-1">
          Drop PDF files here or click to browse
        </p>
        <p className="text-sm text-[var(--color-stone)]">
          Maximum file size: 50MB per file
        </p>
      </div>

      {/* File List */}
      {hasFiles && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-[var(--color-ink)]">
              Files to Upload ({files.length})
            </h3>
            {pendingCount > 0 && (
              <Button onClick={uploadAll} size="sm">
                Upload All ({pendingCount})
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {files.map((fileItem, index) => (
              <div
                key={index}
                className="bg-white border border-[var(--color-parchment)] rounded-lg p-4"
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div
                    className={clsx(
                      'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                      fileItem.status === 'success'
                        ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
                        : fileItem.status === 'error'
                        ? 'bg-[var(--color-error)]/10 text-[var(--color-error)]'
                        : 'bg-[var(--color-parchment)] text-[var(--color-forest)]'
                    )}
                  >
                    {fileItem.status === 'uploading' ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : fileItem.status === 'success' ? (
                      <CheckCircle size={20} />
                    ) : fileItem.status === 'error' ? (
                      <AlertCircle size={20} />
                    ) : (
                      <FileText size={20} />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {fileItem.status === 'pending' ? (
                      <div className="space-y-3">
                        <Input
                          placeholder="Paper title (optional - will be auto-extracted)"
                          value={fileItem.title}
                          onChange={(e) =>
                            updateFile(index, { title: e.target.value })
                          }
                        />
                        <Input
                          placeholder="Authors (optional - will be auto-extracted)"
                          value={fileItem.authors}
                          onChange={(e) =>
                            updateFile(index, { authors: e.target.value })
                          }
                        />
                        <p className="text-xs text-[var(--color-stone)] italic">
                          💡 Leave blank to auto-extract from PDF using AI
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleUploadFile(index)}
                          >
                            Upload
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeFile(index)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="font-medium text-[var(--color-ink)] truncate">
                          {fileItem.title}
                        </p>
                        {fileItem.authors && (
                          <p className="text-sm text-[var(--color-stone)] truncate">
                            {fileItem.authors}
                          </p>
                        )}
                        {fileItem.status === 'uploading' && (
                          <div className="mt-2">
                            <div className="h-1.5 bg-[var(--color-parchment)] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[var(--color-forest)] rounded-full transition-all duration-300"
                                style={{ width: `${fileItem.progress}%` }}
                              />
                            </div>
                          </div>
                        )}
                        {fileItem.status === 'success' && (
                          <p className="text-sm text-[var(--color-success)] mt-1">
                            Uploaded successfully! Processing will begin shortly.
                          </p>
                        )}
                        {fileItem.status === 'error' && (
                          <p className="text-sm text-[var(--color-error)] mt-1">
                            {fileItem.error}
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  {/* Remove button */}
                  {fileItem.status !== 'uploading' && (
                    <button
                      onClick={() => removeFile(index)}
                      className="p-1 text-[var(--color-stone)] hover:text-[var(--color-error)] transition-colors"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hint */}
      {!hasFiles && (
        <p className="text-center text-sm text-[var(--color-stone)] italic">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-amber)] mr-2" />
          After uploading, papers will be processed automatically. This usually takes 1-2 minutes.
        </p>
      )}
    </div>
  );
}

