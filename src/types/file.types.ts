export const FileProcessingStatus = {
  Pending: 'pending',
  Processing: 'processing',
  Completed: 'completed',
  Failed: 'failed',
} as const;

export type FileProcessingStatus =
  (typeof FileProcessingStatus)[keyof typeof FileProcessingStatus];

export const SupportedMimeTypes = {
  PDF: 'application/pdf',
  PNG: 'image/png',
  JPEG: 'image/jpeg',
  GIF: 'image/gif',
  WEBP: 'image/webp',
  DOC: 'application/msword',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  TXT: 'text/plain',
} as const;

export type SupportedMimeType =
  (typeof SupportedMimeTypes)[keyof typeof SupportedMimeTypes];

export interface FileMetadata {
  id: string;
  sessionId: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  extractedContent?: ExtractedContent;
  processingStatus: FileProcessingStatus;
  processingError?: string;
  createdAt: Date;
}

export interface ExtractedContent {
  textContent: string;
  structure?: DocumentStructure;
  entities?: ExtractedEntities;
  metadata?: DocumentMetadata;
}

export interface DocumentStructure {
  title?: string;
  sections?: Array<{
    heading: string;
    content: string;
    level?: number;
  }>;
  tables?: Array<{
    caption?: string;
    headers: string[];
    rows: string[][];
  }>;
  lists?: Array<{
    type: 'ordered' | 'unordered';
    items: string[];
  }>;
}

export interface ExtractedEntities {
  people?: string[];
  organizations?: string[];
  locations?: string[];
  dates?: string[];
  amounts?: string[];
  products?: string[];
  technologies?: string[];
  custom?: Record<string, string[]>;
}

export interface DocumentMetadata {
  pageCount?: number;
  wordCount?: number;
  characterCount?: number;
  language?: string;
  createdDate?: string;
  modifiedDate?: string;
  author?: string;
}

export interface GeminiExtractionRequest {
  fileId: string;
  mimeType: string;
  fileContent: string;
}

export interface GeminiExtractionResponse {
  success: boolean;
  extractedContent?: ExtractedContent;
  error?: string;
}
