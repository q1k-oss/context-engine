/**
 * File processing status
 */
export const FileProcessingStatus = {
  Pending: 'pending',
  Processing: 'processing',
  Completed: 'completed',
  Failed: 'failed',
} as const;

export type FileProcessingStatus =
  (typeof FileProcessingStatus)[keyof typeof FileProcessingStatus];

/**
 * Supported file MIME types
 */
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

/**
 * File metadata stored in database
 */
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

/**
 * Content extracted from file by Gemini
 * Note: Gemini performs EXTRACTION ONLY, no reasoning
 */
export interface ExtractedContent {
  /** Raw text content extracted from the file */
  textContent: string;

  /** Structural elements identified in the document */
  structure?: DocumentStructure;

  /** Named entities extracted from the content */
  entities?: ExtractedEntities;

  /** Document metadata */
  metadata?: DocumentMetadata;
}

/**
 * Document structure extracted by Gemini
 */
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

/**
 * Named entities extracted by Gemini
 */
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

/**
 * Document metadata extracted by Gemini
 */
export interface DocumentMetadata {
  pageCount?: number;
  wordCount?: number;
  characterCount?: number;
  language?: string;
  createdDate?: string;
  modifiedDate?: string;
  author?: string;
}

/**
 * Gemini extraction request
 */
export interface GeminiExtractionRequest {
  fileId: string;
  mimeType: string;
  fileContent: string; // Base64 encoded
}

/**
 * Gemini extraction response
 */
export interface GeminiExtractionResponse {
  success: boolean;
  extractedContent?: ExtractedContent;
  error?: string;
}
