'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { User, Bot, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

const messageVariants = cva('flex gap-3 w-full', {
  variants: {
    role: {
      user: 'flex-row-reverse',
      assistant: 'flex-row',
    },
  },
  defaultVariants: {
    role: 'assistant',
  },
});

const messageContentVariants = cva(
  'rounded-2xl px-4 py-3 max-w-[85%] break-words',
  {
    variants: {
      role: {
        user: 'bg-primary text-primary-foreground',
        assistant: 'bg-muted text-foreground',
      },
    },
    defaultVariants: {
      role: 'assistant',
    },
  }
);

interface MessageProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'role'>, VariantProps<typeof messageVariants> {
  children: React.ReactNode;
}

function Message({ className, role, children, ...props }: MessageProps) {
  return (
    <div className={cn(messageVariants({ role }), className)} {...props}>
      {children}
    </div>
  );
}

interface MessageAvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  role: 'user' | 'assistant';
}

function MessageAvatar({ role, className, ...props }: MessageAvatarProps) {
  return (
    <div
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
        role === 'user' ? 'bg-primary' : 'bg-muted-foreground',
        className
      )}
      {...props}
    >
      {role === 'user' ? (
        <User className="h-4 w-4 text-primary-foreground" />
      ) : (
        <Bot className="h-4 w-4 text-background" />
      )}
    </div>
  );
}

interface MessageContentProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'role'>,
    VariantProps<typeof messageContentVariants> {
  children: React.ReactNode;
  isStreaming?: boolean;
  markdown?: boolean;
}

function MessageContent({
  className,
  role,
  children,
  isStreaming,
  markdown = true,
  ...props
}: MessageContentProps) {
  const content = typeof children === 'string' ? children : '';

  return (
    <div className={cn(messageContentVariants({ role }), className)} {...props}>
      {isStreaming && !content ? (
        <MessageLoading />
      ) : markdown && typeof children === 'string' ? (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown>{children}</ReactMarkdown>
          {isStreaming && <MessageStreamingIndicator />}
        </div>
      ) : (
        <>
          {children}
          {isStreaming && <MessageStreamingIndicator />}
        </>
      )}
    </div>
  );
}

function MessageLoading() {
  return (
    <div className="flex items-center gap-1">
      <span
        className="h-2 w-2 animate-bounce rounded-full bg-current"
        style={{ animationDelay: '0ms' }}
      />
      <span
        className="h-2 w-2 animate-bounce rounded-full bg-current"
        style={{ animationDelay: '150ms' }}
      />
      <span
        className="h-2 w-2 animate-bounce rounded-full bg-current"
        style={{ animationDelay: '300ms' }}
      />
    </div>
  );
}

function MessageStreamingIndicator() {
  return (
    <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-current opacity-50" />
  );
}

interface MessageGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

function MessageGroup({ className, children, ...props }: MessageGroupProps) {
  return (
    <div className={cn('flex flex-col gap-4', className)} {...props}>
      {children}
    </div>
  );
}

export {
  Message,
  MessageAvatar,
  MessageContent,
  MessageLoading,
  MessageStreamingIndicator,
  MessageGroup,
};
