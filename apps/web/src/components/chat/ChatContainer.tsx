'use client';

import { useEffect, useCallback, useState } from 'react';
import { useChat } from '@/hooks/useChat';
import { apiClient } from '@/lib/api-client';
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ui/conversation';
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageGroup,
} from '@/components/ui/message';
import {
  Composer,
  ComposerAttachments,
  ComposerInputArea,
  ComposerInput,
  ComposerAttachButton,
  ComposerSendButton,
  type AttachedFile,
} from '@/components/ui/composer';
import { AlertCircle, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatContainerProps {
  sessionId: string;
  onGraphUpdate?: (version: number) => void;
}

export function ChatContainer({ sessionId, onGraphUpdate }: ChatContainerProps) {
  const { messages, isLoading, error, sendMessage, loadMessages } = useChat({
    sessionId,
    onGraphUpdate,
  });

  const [input, setInput] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);

  // Load messages when session changes
  useEffect(() => {
    loadMessages();
    setInput('');
    setAttachedFiles([]);
  }, [loadMessages, sessionId]);

  const handleFileSelect = useCallback(
    async (files: FileList) => {
      for (const file of Array.from(files)) {
        const tempId = `temp-${Date.now()}-${file.name}`;
        setAttachedFiles((prev) => [
          ...prev,
          { id: tempId, name: file.name, status: 'uploading' },
        ]);

        try {
          const result = await apiClient.uploadFile(sessionId, file);
          if (result.success && result.data.fileId) {
            setAttachedFiles((prev) =>
              prev.map((f) =>
                f.id === tempId
                  ? { ...f, id: result.data.fileId, status: 'ready' }
                  : f
              )
            );
          } else {
            setAttachedFiles((prev) =>
              prev.map((f) => (f.id === tempId ? { ...f, status: 'error' } : f))
            );
          }
        } catch (error) {
          setAttachedFiles((prev) =>
            prev.map((f) => (f.id === tempId ? { ...f, status: 'error' } : f))
          );
        }
      }
    },
    [sessionId]
  );

  const handleSubmit = useCallback(async () => {
    if (!input.trim() && attachedFiles.length === 0) return;

    const fileIds = attachedFiles
      .filter((f) => f.status === 'ready')
      .map((f) => f.id);

    await sendMessage(input.trim(), fileIds.length > 0 ? fileIds : undefined);
    setInput('');
    setAttachedFiles([]);
  }, [input, attachedFiles, sendMessage]);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Messages area */}
      <Conversation className="flex-1">
        {messages.length === 0 ? (
          <ConversationEmptyState
            title="Context Engine"
            description="Start a conversation to build your knowledge graph. Your context will evolve as we chat."
            icon={<MessageSquare className="h-12 w-12 text-muted-foreground" />}
          />
        ) : (
          <ConversationContent className="mx-auto max-w-3xl">
            <MessageGroup>
              {messages.map((message) => (
                <Message key={message.id} role={message.role}>
                  <MessageAvatar role={message.role} />
                  <MessageContent
                    role={message.role}
                    isStreaming={message.isStreaming}
                    markdown={message.role === 'assistant'}
                  >
                    {message.content}
                  </MessageContent>
                </Message>
              ))}
            </MessageGroup>
          </ConversationContent>
        )}
        <ConversationScrollButton />
      </Conversation>

      {/* Error display */}
      {error && (
        <div className="mx-auto max-w-3xl px-4 py-2">
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-4 py-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-border bg-background">
        <div className="mx-auto max-w-3xl p-4">
          <Composer
            input={input}
            onInputChange={setInput}
            onSubmit={handleSubmit}
            isLoading={isLoading}
          >
            {attachedFiles.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {attachedFiles.map((file) => (
                  <div
                    key={file.id}
                    className={cn(
                      'flex items-center gap-2 rounded-full px-3 py-1 text-xs',
                      file.status === 'uploading' && 'bg-yellow-100 text-yellow-800',
                      file.status === 'ready' && 'bg-green-100 text-green-800',
                      file.status === 'error' && 'bg-red-100 text-red-800'
                    )}
                  >
                    <span className="max-w-[150px] truncate">{file.name}</span>
                    <button
                      onClick={() =>
                        setAttachedFiles((prev) => prev.filter((f) => f.id !== file.id))
                      }
                      className="hover:opacity-70"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <ComposerInputArea>
              <ComposerAttachButton onFileSelect={handleFileSelect} />
              <ComposerInput />
              <ComposerSendButton />
            </ComposerInputArea>
          </Composer>
        </div>
      </div>
    </div>
  );
}
