export const MessageRole = {
  User: 'user',
  Assistant: 'assistant',
  System: 'system',
} as const;

export type MessageRole = (typeof MessageRole)[keyof typeof MessageRole];

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

export interface Session {
  id: string;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionWithMessages extends Session {
  messages: Message[];
}

export interface SessionWithContext extends SessionWithMessages {
  graphVersion: number;
  nodeCount: number;
  edgeCount: number;
}

export interface CreateSessionRequest {
  title?: string;
}

export interface CreateSessionResponse {
  session: Session;
}

export interface SendMessageRequest {
  content: string;
  fileIds?: string[];
}

export const SSEEventType = {
  TextDelta: 'text_delta',
  MessageComplete: 'message_complete',
  GraphUpdate: 'graph_update',
  Error: 'error',
} as const;

export type SSEEventType = (typeof SSEEventType)[keyof typeof SSEEventType];

export interface TextDeltaEvent {
  type: typeof SSEEventType.TextDelta;
  data: {
    delta: string;
    accumulated: string;
  };
}

export interface MessageCompleteEvent {
  type: typeof SSEEventType.MessageComplete;
  data: {
    messageId: string;
    content: string;
    tokenCount: number;
  };
}

export interface GraphUpdateEvent {
  type: typeof SSEEventType.GraphUpdate;
  data: {
    nodesAdded: number;
    nodesModified: number;
    newVersion: number;
  };
}

export interface SSEErrorEvent {
  type: typeof SSEEventType.Error;
  data: {
    code: string;
    message: string;
  };
}

export type SSEEvent =
  | TextDeltaEvent
  | MessageCompleteEvent
  | GraphUpdateEvent
  | SSEErrorEvent;

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

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
