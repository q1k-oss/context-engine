import type { KnowledgeGraph, ContextDelta, GraphVersion } from './knowledge-graph.types.js';
import type { Session, Message, SessionWithMessages } from './chat.types.js';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface ListSessionsResponse {
  sessions: Session[];
}

export interface CreateSessionBody {
  title?: string;
}

export interface GetSessionResponse {
  session: SessionWithMessages;
}

export interface SendMessageBody {
  content: string;
  fileIds?: string[];
}

export interface GetGraphResponse {
  graph: KnowledgeGraph;
}

export interface ListGraphVersionsResponse {
  versions: Array<{
    version: number;
    createdAt: Date;
    nodeCount: number;
    edgeCount: number;
  }>;
}

export interface GetGraphVersionResponse {
  version: GraphVersion;
}

export interface ListDeltasResponse {
  deltas: ContextDelta[];
}

export interface GetDeltaResponse {
  delta: ContextDelta;
}

export interface UploadFileResponse {
  fileId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface GetFileResponse {
  id: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
}

export interface GetFileContentResponse {
  extractedContent: {
    textContent: string;
    structure?: {
      title?: string;
      sections?: Array<{
        heading: string;
        content: string;
      }>;
      tables?: Array<{
        headers: string[];
        rows: string[][];
      }>;
    };
    entities?: {
      people?: string[];
      organizations?: string[];
      dates?: string[];
      locations?: string[];
    };
    metadata?: {
      pageCount?: number;
      wordCount?: number;
      language?: string;
    };
  };
}
