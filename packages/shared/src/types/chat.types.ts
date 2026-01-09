/**
 * Message role in conversation
 */
export const MessageRole = {
  User: 'user',
  Assistant: 'assistant',
  System: 'system',
} as const;

export type MessageRole = (typeof MessageRole)[keyof typeof MessageRole];

/**
 * Chat message
 */
export interface Message {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  sequenceNumber: number;
  tokenCount?: number;
  attachedFileIds?: string[];
  createdAt: Date;
}

/**
 * Chat session
 */
export interface Session {
  id: string;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Session with messages
 */
export interface SessionWithMessages extends Session {
  messages: Message[];
}

/**
 * Session with full context
 */
export interface SessionWithContext extends SessionWithMessages {
  graphVersion: number;
  nodeCount: number;
  edgeCount: number;
}

/**
 * Create session request
 */
export interface CreateSessionRequest {
  title?: string;
}

/**
 * Create session response
 */
export interface CreateSessionResponse {
  session: Session;
}

/**
 * Send message request
 */
export interface SendMessageRequest {
  content: string;
  fileIds?: string[];
}

/**
 * SSE event types for streaming responses
 */
export const SSEEventType = {
  TextDelta: 'text_delta',
  MessageComplete: 'message_complete',
  GraphUpdate: 'graph_update',
  Error: 'error',
} as const;

export type SSEEventType = (typeof SSEEventType)[keyof typeof SSEEventType];

/**
 * SSE text delta event
 */
export interface TextDeltaEvent {
  type: typeof SSEEventType.TextDelta;
  data: {
    delta: string;
    accumulated: string;
  };
}

/**
 * SSE message complete event
 */
export interface MessageCompleteEvent {
  type: typeof SSEEventType.MessageComplete;
  data: {
    messageId: string;
    content: string;
    tokenCount: number;
  };
}

/**
 * SSE graph update event
 */
export interface GraphUpdateEvent {
  type: typeof SSEEventType.GraphUpdate;
  data: {
    nodesAdded: number;
    nodesModified: number;
    newVersion: number;
  };
}

/**
 * SSE error event
 */
export interface SSEErrorEvent {
  type: typeof SSEEventType.Error;
  data: {
    code: string;
    message: string;
  };
}

/**
 * Union of all SSE events
 */
export type SSEEvent =
  | TextDeltaEvent
  | MessageCompleteEvent
  | GraphUpdateEvent
  | SSEErrorEvent;

/**
 * Claude message format
 */
export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Context for Claude including knowledge graph data
 */
export interface ClaudeContext {
  systemPrompt: string;
  messages: ClaudeMessage[];
  relevantNodes: Array<{
    name: string;
    type: string;
    description?: string;
    priority: number;
  }>;
  relevantEdges: Array<{
    source: string;
    target: string;
    relationship: string;
  }>;
}
