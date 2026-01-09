'use client';

import { useState, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api-client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

interface UseChatOptions {
  sessionId: string;
  onGraphUpdate?: (version: number) => void;
}

interface UseChatReturn {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string, fileIds?: string[]) => Promise<void>;
  loadMessages: () => Promise<void>;
}

/**
 * Hook for managing chat with SSE streaming responses
 */
export function useChat({ sessionId, onGraphUpdate }: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Load existing messages for the session
   */
  const loadMessages = useCallback(async () => {
    try {
      const data = await apiClient.getSession(sessionId);
      if (data.success && data.data.session.messages) {
        setMessages(
          data.data.session.messages.map((m: { id: string; role: string; content: string }) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
          }))
        );
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  }, [sessionId]);

  /**
   * Send a message and stream the response
   */
  const sendMessage = useCallback(
    async (content: string, fileIds?: string[]) => {
      if (!content.trim() || isLoading) return;

      setError(null);
      setIsLoading(true);

      // Add user message immediately (optimistic update)
      const userMessageId = `temp-${Date.now()}`;
      const userMessage: Message = {
        id: userMessageId,
        role: 'user',
        content,
      };
      setMessages((prev) => [...prev, userMessage]);

      // Add placeholder for assistant response
      const assistantMessageId = `temp-${Date.now() + 1}`;
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        isStreaming: true,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      try {
        // Create abort controller for potential cancellation
        abortControllerRef.current = new AbortController();

        // Send message and get SSE response
        const response = await apiClient.sendMessage(sessionId, content, fileIds);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('No response body');
        }

        let buffer = '';
        let finalMessageId = assistantMessageId;
        let finalContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const event = JSON.parse(data);

                switch (event.type) {
                  case 'text_delta':
                    finalContent = event.data.accumulated;
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMessageId
                          ? { ...m, content: event.data.accumulated }
                          : m
                      )
                    );
                    break;

                  case 'message_complete':
                    finalMessageId = event.data.messageId;
                    finalContent = event.data.content;
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMessageId
                          ? {
                              ...m,
                              id: event.data.messageId,
                              content: event.data.content,
                              isStreaming: false,
                            }
                          : m
                      )
                    );
                    break;

                  case 'graph_update':
                    if (onGraphUpdate) {
                      onGraphUpdate(event.data.newVersion);
                    }
                    break;

                  case 'error':
                    setError(event.data.message);
                    break;
                }
              } catch (e) {
                // Ignore JSON parse errors for partial data
              }
            }
          }
        }
      } catch (err) {
        console.error('Send message error:', err);
        setError(err instanceof Error ? err.message : 'Failed to send message');

        // Remove the failed messages
        setMessages((prev) =>
          prev.filter((m) => m.id !== userMessageId && m.id !== assistantMessageId)
        );
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [sessionId, isLoading, onGraphUpdate]
  );

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    loadMessages,
  };
}
