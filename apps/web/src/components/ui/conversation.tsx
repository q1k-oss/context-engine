'use client';

import * as React from 'react';
import { ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConversationContextValue {
  isAtBottom: boolean;
  scrollToBottom: () => void;
}

const ConversationContext = React.createContext<ConversationContextValue | null>(null);

function useConversationContext() {
  const context = React.useContext(ConversationContext);
  if (!context) {
    throw new Error('Conversation components must be used within a Conversation');
  }
  return context;
}

interface ConversationProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

function Conversation({ className, children, ...props }: ConversationProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = React.useState(true);

  const scrollToBottom = React.useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  const handleScroll = React.useCallback(() => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      setIsAtBottom(scrollHeight - scrollTop - clientHeight < 50);
    }
  }, []);

  // Auto-scroll to bottom when content changes
  React.useEffect(() => {
    if (isAtBottom) {
      scrollToBottom();
    }
  });

  return (
    <ConversationContext.Provider value={{ isAtBottom, scrollToBottom }}>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={cn('relative flex h-full flex-col overflow-y-auto', className)}
        role="log"
        {...props}
      >
        <div className="flex flex-1 flex-col">
          {children}
        </div>
      </div>
    </ConversationContext.Provider>
  );
}

interface ConversationContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

function ConversationContent({ className, children, ...props }: ConversationContentProps) {
  return (
    <div className={cn('flex flex-1 flex-col gap-4 px-4 py-4', className)} {...props}>
      {children}
    </div>
  );
}

interface ConversationEmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
}

function ConversationEmptyState({
  title = 'No messages yet',
  description = 'Start a conversation to see messages here',
  icon,
  className,
  ...props
}: ConversationEmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-1 flex-col items-center justify-center gap-2 text-center',
        className
      )}
      {...props}
    >
      {icon}
      <h3 className="text-xl font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function ConversationScrollButton({ className }: { className?: string }) {
  const { isAtBottom, scrollToBottom } = useConversationContext();

  if (isAtBottom) return null;

  return (
    <button
      onClick={scrollToBottom}
      className={cn(
        'absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-primary p-2 text-primary-foreground shadow-lg transition-opacity hover:opacity-90',
        className
      )}
      aria-label="Scroll to bottom"
    >
      <ArrowDown className="h-4 w-4" />
    </button>
  );
}

export {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
  useConversationContext,
};
