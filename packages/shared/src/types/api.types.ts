import type { KnowledgeGraph, ContextDelta, GraphVersion } from './knowledge-graph.types.js';
import type { Session, Message, SessionWithMessages } from './chat.types.js';

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

/**
 * API error structure
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  limit?: number;
  offset?: number;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// ============ Chat API Types ============

/**
 * GET /api/chat/sessions
 */
export interface ListSessionsResponse {
  sessions: Session[];
}

/**
 * POST /api/chat/sessions
 */
export interface CreateSessionBody {
  title?: string;
}

/**
 * GET /api/chat/sessions/:id
 */
export interface GetSessionResponse {
  session: SessionWithMessages;
}

/**
 * POST /api/chat/sessions/:id/messages
 * Response is SSE stream
 */
export interface SendMessageBody {
  content: string;
  fileIds?: string[];
}

// ============ Graph API Types ============

/**
 * GET /api/graph/:sessionId
 */
export interface GetGraphResponse {
  graph: KnowledgeGraph;
}

/**
 * GET /api/graph/:sessionId/versions
 */
export interface ListGraphVersionsResponse {
  versions: Array<{
    version: number;
    createdAt: Date;
    nodeCount: number;
    edgeCount: number;
  }>;
}

/**
 * GET /api/graph/:sessionId/versions/:version
 */
export interface GetGraphVersionResponse {
  version: GraphVersion;
}

/**
 * GET /api/graph/:sessionId/deltas
 */
export interface ListDeltasResponse {
  deltas: ContextDelta[];
}

/**
 * GET /api/graph/:sessionId/deltas/:deltaId
 */
export interface GetDeltaResponse {
  delta: ContextDelta;
}

// ============ File API Types ============

/**
 * POST /api/files/upload
 */
export interface UploadFileResponse {
  fileId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

/**
 * GET /api/files/:id
 */
export interface GetFileResponse {
  id: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
}

/**
 * GET /api/files/:id/content
 */
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
